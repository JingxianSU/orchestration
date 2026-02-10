"""
Provenance event storage functions.
"""
from __future__ import annotations

import os
import time
from typing import List, Literal, Optional

from fastapi import Request

from models.provenance import ProvEvent
from models.chat import HistoryItem
from utils.helpers import iso_utc_now, sha256_hex, canonical_json_bytes
from utils.orch_headers import extract_orch_headers_from_request
from db import MongoStore


# Get mongo instance (will be set from main)
_mongo: Optional[MongoStore] = None


def set_mongo_store(mongo: MongoStore) -> None:
    """Set the MongoDB store instance."""
    global _mongo
    _mongo = mongo


def get_mongo_store() -> Optional[MongoStore]:
    """Get the MongoDB store instance."""
    return _mongo


async def store_initial_message_prov_event(
    *,
    message_id: str,
    trace_id: str,
    message: str,
    history: Optional[List[HistoryItem]] = None,
    is_auto_mode: bool = False,
    request: Request
) -> ProvEvent:
    """Store initial user message provenance event."""
    
    if not os.getenv("MONGODB_URI") or _mongo is None:
        return ProvEvent(
            event_id=message_id,
            trace_id=trace_id,
            timestamp=iso_utc_now(),
            actor="client",
            module_id="client-frontend",
            envelope_type="hitlRequest" if not is_auto_mode else "policyEvaluate",
            status="SUCCESS",
            event_hash="",
        )
    
    orch = extract_orch_headers_from_request(request)
    event_id = message_id
    session_id = orch.get("session_id") or None
    actor = "client"
    module_id = "client-frontend"
    ledger_anchor = orch.get("ledger_anchor") or os.getenv("ORCH_LEDGER_ANCHOR") or None
    
    prev_hash: Optional[str] = None
    try:
        prev_hash = await _mongo.get_last_event_hash(session_id=session_id, trace_id=trace_id)
    except Exception:
        prev_hash = None
    
    timestamp = iso_utc_now()
    
    if is_auto_mode:
        envelope_type = "policyEvaluate"
        params = {
            "action": "",
            "context": {},
            "payload": {
                "message": message,
                "history": [h.model_dump() for h in history] if history else []
            },
            "dry_run": False
        }
    else:
        envelope_type = "hitlRequest"
        params = {
            "reason": "User message requires manual review",
            "required_role": "admin",
            "payload": {
                "message": message,
                "history": [h.model_dump() for h in history] if history else []
            },
            "proposed_action": "review_and_approve",
            "risk": "medium"
        }
    
    import uuid
    envelope = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "envelope_type": envelope_type,
        "params": params,
        "_meta": {
            "trace_id": trace_id,
            "message_id": message_id,
            "timestamp": timestamp,
            "is_auto_mode": is_auto_mode
        }
    }
    
    input_ref = {"envelope": envelope}
    output_ref = None
    policy_ref = {
        "policy_type": "user_message_review",
        "enforcement_level": "mandatory" if not is_auto_mode else "automatic",
        "review_status": "pending"
    }
    
    preimage = {
        "event_id": event_id,
        "session_id": session_id,
        "trace_id": trace_id,
        "timestamp": timestamp,
        "actor": actor,
        "module_id": module_id,
        "envelope_type": envelope_type,
        "input_ref": input_ref,
        "output_ref": output_ref,
        "policy_ref": policy_ref,
        "risk": "pending_review" if not is_auto_mode else "auto_review",
        "status": "SUCCESS",
        "prev_event_hash": prev_hash,
        "ledger_anchor": ledger_anchor,
        "meta": {
            "message_id": message_id,
            "received_at": int(time.time() * 1000),
            "is_auto_mode": is_auto_mode
        }
    }
    
    event_hash = sha256_hex(canonical_json_bytes(preimage))
    
    prov = ProvEvent(
        event_id=event_id,
        session_id=session_id,
        trace_id=trace_id,
        timestamp=timestamp,
        actor=actor,
        module_id=module_id,
        envelope_type=envelope_type,
        input_ref=input_ref,
        output_ref=output_ref,
        policy_ref=policy_ref,
        risk="pending_review" if not is_auto_mode else "auto_review",
        status="SUCCESS",
        prev_event_hash=prev_hash,
        event_hash=event_hash,
        ledger_anchor=ledger_anchor,
        meta=preimage["meta"]
    )
    
    try:
        doc = {"provenance": prov.model_dump(), "timestamp_ms": int(time.time() * 1000)}
        await _mongo.insert_prov_event(doc)
        print(f"[PROV-INITIAL] Stored initial message event: {event_id}")
    except Exception as e:
        print(f"[PROV-INITIAL] Error storing initial message: {str(e)}")
    
    return prov


async def store_llm_result_prov_event(
    *,
    message_id: str,
    trace_id: str,
    llm_response: str,
    original_message: str,
    request: Request
) -> ProvEvent:
    """Store LLM raw result provenance event."""
    
    if not os.getenv("MONGODB_URI") or _mongo is None:
        return ProvEvent(
            event_id=f"llm-result-{message_id}",
            trace_id=trace_id,
            timestamp=iso_utc_now(),
            actor="claude-api",
            module_id="claude-backend",
            envelope_type="LLMRawResultEnvelope",
            status="SUCCESS",
            event_hash="",
        )
    
    orch = extract_orch_headers_from_request(request)
    event_id = f"llm-result-{message_id}"
    session_id = orch.get("session_id") or None
    actor = "claude-api"
    module_id = "claude-backend"
    ledger_anchor = orch.get("ledger_anchor") or os.getenv("ORCH_LEDGER_ANCHOR") or None
    
    prev_hash: Optional[str] = None
    try:
        prev_hash = await _mongo.get_last_event_hash(session_id=session_id, trace_id=trace_id)
    except Exception:
        prev_hash = None
    
    envelope_type = "LLMRawResultEnvelope"
    timestamp = iso_utc_now()
    
    input_ref = {
        "message_id": message_id,
        "original_message": original_message,
        "request_type": "llm_generation"
    }
    
    output_ref = {
        "llm_response": llm_response,
        "timestamp": timestamp,
        "requires_review": True
    }
    
    policy_ref = {
        "policy_type": "llm_output_review",
        "enforcement_level": "mandatory",
        "review_status": "pending"
    }
    
    preimage = {
        "event_id": event_id,
        "session_id": session_id,
        "trace_id": trace_id,
        "timestamp": timestamp,
        "actor": actor,
        "module_id": module_id,
        "envelope_type": envelope_type,
        "input_ref": input_ref,
        "output_ref": output_ref,
        "policy_ref": policy_ref,
        "risk": "pending_review",
        "status": "SUCCESS",
        "prev_event_hash": prev_hash,
        "ledger_anchor": ledger_anchor,
        "meta": {
            "message_id": message_id,
            "generated_at": int(time.time() * 1000)
        }
    }
    
    event_hash = sha256_hex(canonical_json_bytes(preimage))
    
    prov = ProvEvent(
        event_id=event_id,
        session_id=session_id,
        trace_id=trace_id,
        timestamp=timestamp,
        actor=actor,
        module_id=module_id,
        envelope_type=envelope_type,
        input_ref=input_ref,
        output_ref=output_ref,
        policy_ref=policy_ref,
        risk="pending_review",
        status="SUCCESS",
        prev_event_hash=prev_hash,
        event_hash=event_hash,
        ledger_anchor=ledger_anchor,
        meta=preimage["meta"]
    )
    
    try:
        doc = {"provenance": prov.model_dump(), "timestamp_ms": int(time.time() * 1000)}
        await _mongo.insert_prov_event(doc)
        print(f"[PROV-LLM] Stored LLM result event: {event_id}")
    except Exception as e:
        print(f"[PROV-LLM] Error storing LLM result: {str(e)}")
    
    return prov


async def store_final_response_prov_event(
    *,
    message_id: str,
    trace_id: str,
    final_response: str,
    original_message: str,
    edit_type: str,
    reviewer: str,
    request: Request
) -> ProvEvent:
    """Store final response provenance event."""
    
    if not os.getenv("MONGODB_URI") or _mongo is None:
        return ProvEvent(
            event_id=f"final-{message_id}",
            trace_id=trace_id,
            timestamp=iso_utc_now(),
            actor=reviewer,
            module_id="admin-dashboard",
            envelope_type="FinalResponseEnvelope",
            status="SUCCESS",
            event_hash="",
        )
    
    orch = extract_orch_headers_from_request(request)
    event_id = message_id
    session_id = orch.get("session_id") or None
    actor = reviewer
    module_id = "admin-dashboard"
    ledger_anchor = orch.get("ledger_anchor") or os.getenv("ORCH_LEDGER_ANCHOR") or None
    
    prev_hash: Optional[str] = None
    try:
        prev_hash = await _mongo.get_last_event_hash(session_id=session_id, trace_id=trace_id)
    except Exception:
        prev_hash = None
    
    envelope_type = "FinalResponseEnvelope"
    timestamp = iso_utc_now()
    
    input_ref = {
        "message_id": message_id,
        "original_message": original_message,
        "review_type": "secondary_approval"
    }
    
    output_ref = {
        "final_response": final_response,
        "edit_type": edit_type,
        "timestamp": timestamp,
        "delivered_to_client": True
    }
    
    policy_ref = {
        "policy_type": "secondary_review_complete",
        "enforcement_level": "mandatory",
        "approval_status": "approved"
    }
    
    preimage = {
        "event_id": event_id,
        "session_id": session_id,
        "trace_id": trace_id,
        "timestamp": timestamp,
        "actor": actor,
        "module_id": module_id,
        "envelope_type": envelope_type,
        "input_ref": input_ref,
        "output_ref": output_ref,
        "policy_ref": policy_ref,
        "risk": "reviewed_and_approved",
        "status": "SUCCESS",
        "prev_event_hash": prev_hash,
        "ledger_anchor": ledger_anchor,
        "meta": {
            "message_id": message_id,
            "delivered_at": int(time.time() * 1000),
            "edit_type": edit_type
        }
    }
    
    event_hash = sha256_hex(canonical_json_bytes(preimage))
    
    prov = ProvEvent(
        event_id=event_id,
        session_id=session_id,
        trace_id=trace_id,
        timestamp=timestamp,
        actor=actor,
        module_id=module_id,
        envelope_type=envelope_type,
        input_ref=input_ref,
        output_ref=output_ref,
        policy_ref=policy_ref,
        risk="reviewed_and_approved",
        status="SUCCESS",
        prev_event_hash=prev_hash,
        event_hash=event_hash,
        ledger_anchor=ledger_anchor,
        meta=preimage["meta"]
    )
    
    try:
        doc = {"provenance": prov.model_dump(), "timestamp_ms": int(time.time() * 1000)}
        await _mongo.insert_prov_event(doc)
        print(f"[PROV-FINAL] Stored final response event: {event_id}")
    except Exception as e:
        print(f"[PROV-FINAL] Error storing final response: {str(e)}")
    
    return prov


async def store_hitl_decision_prov_event(
    *,
    message_id: str,
    trace_id: str,
    decision: Literal["ALLOW", "DENY"],
    reviewer: str,
    comments: Optional[str] = None,
    override_reason: Optional[str] = None,
    original_message: str,
    request: Request,
    override_message: Optional[str] = None,
    admin_prompt: Optional[str] = None,
) -> ProvEvent:
    """Store HITL decision provenance event."""
    
    if not os.getenv("MONGODB_URI") or _mongo is None:
        return ProvEvent(
            event_id=f"hitl-{message_id}",
            trace_id=trace_id,
            timestamp=iso_utc_now(),
            actor=reviewer,
            module_id="admin-dashboard",
            envelope_type="HITLDecisionEnvelope",
            status="SUCCESS",
            event_hash="",
        )
    
    orch = extract_orch_headers_from_request(request)
    event_id = f"hitl-decision-{message_id}"
    session_id = orch.get("session_id") or None
    actor = reviewer
    module_id = "admin-dashboard"
    ledger_anchor = orch.get("ledger_anchor") or os.getenv("ORCH_LEDGER_ANCHOR") or None
    
    prev_hash: Optional[str] = None
    try:
        prev_hash = await _mongo.get_last_event_hash(session_id=session_id, trace_id=trace_id)
    except Exception:
        prev_hash = None
    
    envelope_type = "HITLDecisionEnvelope"
    timestamp = iso_utc_now()
    
    input_ref = {
        "message_id": message_id,
        "original_message": original_message,
        "decision_type": "admin_review"
    }
    
    output_ref = {
        "decision": decision,
        "reviewer": reviewer,
        "comments": comments,
        "override_reason": override_reason,
        "timestamp": timestamp,
        "override_message": override_message,
        "admin_prompt": admin_prompt,
    }
    
    policy_ref = {
        "policy_type": "human_in_the_loop",
        "enforcement_level": "mandatory",
        "decision": decision
    }
    
    preimage = {
        "event_id": event_id,
        "session_id": session_id,
        "trace_id": trace_id,
        "timestamp": timestamp,
        "actor": actor,
        "module_id": module_id,
        "envelope_type": envelope_type,
        "input_ref": input_ref,
        "output_ref": output_ref,
        "policy_ref": policy_ref,
        "risk": "admin_reviewed",
        "status": "SUCCESS",
        "prev_event_hash": prev_hash,
        "ledger_anchor": ledger_anchor,
        "meta": {
            "message_id": message_id,
            "decision_timestamp": int(time.time() * 1000),
            "approve": decision == "ALLOW"
        }
    }
    
    event_hash = sha256_hex(canonical_json_bytes(preimage))
    
    prov = ProvEvent(
        event_id=event_id,
        session_id=session_id,
        trace_id=trace_id,
        timestamp=timestamp,
        actor=actor,
        module_id=module_id,
        envelope_type=envelope_type,
        input_ref=input_ref,
        output_ref=output_ref,
        policy_ref=policy_ref,
        risk="admin_reviewed",
        status="SUCCESS",
        prev_event_hash=prev_hash,
        event_hash=event_hash,
        ledger_anchor=ledger_anchor,
        meta=preimage["meta"]
    )
    
    try:
        doc = {"provenance": prov.model_dump(), "timestamp_ms": int(time.time() * 1000)}
        await _mongo.insert_prov_event(doc)
        print(f"[PROV-HITL] Stored HITL decision event: {event_id}")
    except Exception as e:
        print(f"[PROV-HITL] Error storing HITL decision: {str(e)}")
    
    return prov


async def store_policy_evaluation_prov_event(
    *,
    message_id: str,
    trace_id: str,
    decision: Literal["ALLOW", "PARTIAL_ALLOW", "DENY", "HITL_REQUIRED", "ESCALATION_REQUIRED"],
    policy_binding_id: str,
    original_message: str,
    constraints: Optional[List[str]] = None,
    requires_hitl: bool = False,
    residual_risk: Optional[str] = None,
    request: Request
) -> ProvEvent:
    """Store policy evaluation provenance event."""
    
    if not os.getenv("MONGODB_URI") or _mongo is None:
        return ProvEvent(
            event_id=f"policy-eval-{message_id}",
            trace_id=trace_id,
            timestamp=iso_utc_now(),
            actor="policy_engine",
            module_id="auto-approval-system",
            envelope_type="policyEvaluationResult",
            status="SUCCESS",
            event_hash="",
        )
    
    orch = extract_orch_headers_from_request(request)
    event_id = f"policy-eval-{message_id}"
    session_id = orch.get("session_id") or None
    actor = "policy_engine"
    module_id = "auto-approval-system"
    ledger_anchor = orch.get("ledger_anchor") or os.getenv("ORCH_LEDGER_ANCHOR") or None
    
    prev_hash: Optional[str] = None
    try:
        prev_hash = await _mongo.get_last_event_hash(session_id=session_id, trace_id=trace_id)
    except Exception:
        prev_hash = None
    
    timestamp = iso_utc_now()
    
    import uuid
    envelope = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "envelope_type": "policyEvaluationResult",
        "params": {
            "decision": decision,
            "constraints": constraints or [],
            "requires_hitl": requires_hitl,
            "residual_risk": residual_risk,
            "policy_binding_id": policy_binding_id
        },
        "_meta": {
            "trace_id": trace_id,
            "message_id": message_id,
            "timestamp": timestamp,
            "evaluation_type": "automatic"
        }
    }
    
    input_ref = {"envelope": envelope, "original_message": original_message}
    
    output_ref = {
        "decision": decision,
        "timestamp": timestamp,
        "auto_approved": decision == "ALLOW"
    }
    
    policy_ref = {
        "policy_type": "automatic_evaluation",
        "enforcement_level": "automatic",
        "policy_binding_id": policy_binding_id,
        "evaluation_result": decision
    }
    
    envelope_type = "policyEvaluationResult"
    
    preimage = {
        "event_id": event_id,
        "session_id": session_id,
        "trace_id": trace_id,
        "timestamp": timestamp,
        "actor": actor,
        "module_id": module_id,
        "envelope_type": envelope_type,
        "input_ref": input_ref,
        "output_ref": output_ref,
        "policy_ref": policy_ref,
        "risk": residual_risk or "auto_evaluated",
        "status": "SUCCESS",
        "prev_event_hash": prev_hash,
        "ledger_anchor": ledger_anchor,
        "meta": {
            "message_id": message_id,
            "evaluation_timestamp": int(time.time() * 1000),
            "requires_hitl": requires_hitl
        }
    }
    
    event_hash = sha256_hex(canonical_json_bytes(preimage))
    
    prov = ProvEvent(
        event_id=event_id,
        session_id=session_id,
        trace_id=trace_id,
        timestamp=timestamp,
        actor=actor,
        module_id=module_id,
        envelope_type=envelope_type,
        input_ref=input_ref,
        output_ref=output_ref,
        policy_ref=policy_ref,
        risk=residual_risk or "auto_evaluated",
        status="SUCCESS",
        prev_event_hash=prev_hash,
        event_hash=event_hash,
        ledger_anchor=ledger_anchor,
        meta=preimage["meta"]
    )
    
    try:
        doc = {"provenance": prov.model_dump(), "timestamp_ms": int(time.time() * 1000)}
        await _mongo.insert_prov_event(doc)
        print(f"[PROV-POLICY] Stored policy evaluation event: {event_id}")
    except Exception as e:
        print(f"[PROV-POLICY] Error storing policy evaluation: {str(e)}")
    
    return prov
