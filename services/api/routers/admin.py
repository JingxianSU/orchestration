"""
Admin router - HITL workflow decision endpoints.

Handles primary admin approve/deny decisions, secondary LLM-output review, policy
evaluation retrieval, and on-demand response regeneration. Integrates with the event
bus, message queue, provenance store, policy engine, and external component registry.
"""
from __future__ import annotations

import os
import time
import traceback
import uuid
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from models.admin import AdminDecision, SecondaryReviewDecision, RegenerateRequest
from models.client import ClientResponse
from models.chat import ChatRequest
from models.provenance import Citation
from models.envelopes import ClaudeRequestEnvelope
from services.message_queue import message_queue
from services.event_bus import event_bus
from provenance.events import (
    store_hitl_decision_prov_event,
    store_llm_result_prov_event,
    store_final_response_prov_event,
)
from utils.helpers import iso_utc_now

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# Import execute_chat lazily
_execute_chat = None

def get_execute_chat():
    global _execute_chat
    if _execute_chat is None:
        from services.chat_service import execute_chat
        _execute_chat = execute_chat
    return _execute_chat


@router.post("/decide/{message_id}")
async def admin_decide(
    message_id: str,
    decision: AdminDecision,
    request: Request
) -> Dict[str, Any]:
    """Admin decision: allow or deny (supports override message + admin prompt)."""
    print(f"[ADMIN] Decision for {message_id}: {decision.decision}, reason: {decision.reason}")

    resp = await message_queue.get_response(message_id)
    if not resp:
        raise HTTPException(status_code=404, detail="Message not found")

    msg = await message_queue.get_message(message_id)
    original_message = msg.message if msg else ""

    override_message = (decision.override_message or "").strip()
    final_message = override_message if override_message else original_message

    admin_prompt = (decision.admin_prompt or "").strip() or None
    citation = decision.citation or Citation(
        reason=decision.reason or ("Request approved" if decision.decision == "ALLOW" else "Request denied"),
        references=None,
        reviewer="admin",
        timestamp=iso_utc_now(),
        decision_type="primary_approval" if decision.decision == "ALLOW" else "primary_rejection"
    )

    # Step 4b: HITL -> Orch (admin has made input decision, sending back to orch)
    await event_bus.publish({
        "type": "hitl_admin_decision_input",
        "trace_id": resp.trace_id,
        "ts": int(time.time() * 1000),
        "data": {
            "message_id": message_id,
            "decision": decision.decision,
            "reviewer": "admin",
            "reason": decision.reason or "",
            "override_message": override_message or None,
            "admin_prompt": admin_prompt,
            "timestamp": iso_utc_now(),
        }
    })

    if decision.decision == "DENY":
        try:
            hitl_prov = await store_hitl_decision_prov_event(
                message_id=message_id,
                trace_id=resp.trace_id,
                decision="DENY",
                reviewer="admin",
                comments=decision.reason,
                override_reason=None,
                original_message=original_message,
                request=request,
                override_message=override_message or None,
                admin_prompt=admin_prompt,
            )
            print(f"[ADMIN] Stored rejection to provenance: {hitl_prov.event_id}")
        except Exception as e:
            print(f"[ADMIN] Error storing rejection to provenance: {e}")

        updated_resp = ClientResponse(
            message_id=message_id,
            trace_id=resp.trace_id,
            status="rejected",
            error_code=decision.error_code,
            reason=decision.reason or "Request denied by administrator",
            citation=citation
        )
        await message_queue.update_response(message_id, updated_resp)

        rejection_trace_data = {
            "trace_id": resp.trace_id,
            "message_id": message_id,
            "decision": "DENY",
            "reviewer": "admin",
            "reason": decision.reason or "No reason provided",
            "original_message": original_message[:100] + "..." if len(original_message) > 100 else original_message,
            "timestamp": iso_utc_now(),
            "override_message": override_message or None,
            "admin_prompt": admin_prompt,
            "citation": citation.model_dump()
        }

        await event_bus.publish({
            "type": "hitl_decision",
            "trace_id": resp.trace_id,
            "ts": int(time.time() * 1000),
            "data": rejection_trace_data
        })

        print(f"[ADMIN] Rejected message {message_id}")
        return {"status": "rejected", "message_id": message_id}

    if decision.decision == "ALLOW":
        try:
            hitl_prov = await store_hitl_decision_prov_event(
                message_id=message_id,
                trace_id=resp.trace_id,
                decision="ALLOW",
                reviewer="admin",
                comments=decision.reason,
                override_reason=None,
                original_message=original_message,
                request=request,
                override_message=override_message or None,
                admin_prompt=admin_prompt,
            )
            print(f"[ADMIN] Stored approval to provenance: {hitl_prov.event_id}")
        except Exception as e:
            print(f"[ADMIN] Error storing approval to provenance: {e}")

        approved_resp = ClientResponse(
            message_id=message_id,
            trace_id=resp.trace_id,
            status="approved"
        )
        await message_queue.update_response(message_id, approved_resp)

        # ── Branch: external component (OpenClaw / HTTP / WS) vs internal Claude ──
        component_id = msg.component_id if msg else None

        if component_id:
            # ── External component path ───────────────────────────────────────
            print(f"[ADMIN] Routing approved message to external component: {component_id}")

            message_approved_data: Dict[str, Any] = {
                "trace_id": resp.trace_id,
                "message_id": message_id,
                "decision": "ALLOW",
                "reviewer": "admin",
                "original_message": original_message,
                "effective_message": final_message,
                "admin_prompt": admin_prompt,
                "timestamp": iso_utc_now(),
                "meta": {
                    "message_id": message_id,
                    "approved_at": int(time.time() * 1000),
                    "component_id": component_id,
                }
            }
            await event_bus.publish({
                "type": "message_approved",
                "trace_id": resp.trace_id,
                "ts": int(time.time() * 1000),
                "data": message_approved_data
            })

            try:
                from routers.external_registry import forward_to_component
                forward_result = await forward_to_component(
                    comp_id=component_id,
                    message=final_message,
                    trace_id=resp.trace_id,
                    history=[h.model_dump() for h in (msg.history or [])] if msg and msg.history else None,
                )
                reply_text = forward_result.reply
            except Exception as e:
                print(f"[ADMIN] Error calling external component: {e}")
                traceback.print_exc()
                error_resp = ClientResponse(
                    message_id=message_id,
                    trace_id=resp.trace_id,
                    status="rejected",
                    reason=f"External component error: {str(e)}"
                )
                await message_queue.update_response(message_id, error_resp)
                raise HTTPException(status_code=502, detail=str(e))

            # Store as a synthetic ChatResponse so secondary-review code can reuse it
            from models.chat import ChatResponse as ChatResponseModel
            synthetic_chat_resp = ChatResponseModel(
                trace_id=resp.trace_id,
                reply=reply_text,
                claude_model=component_id,
                claude_request={"component_id": component_id, "message": final_message},
                claude_response={"component_id": component_id, "reply": reply_text},
            )
            await message_queue.store_chat_response(message_id, synthetic_chat_resp)

            try:
                llm_prov = await store_llm_result_prov_event(
                    message_id=message_id,
                    trace_id=resp.trace_id,
                    llm_response=reply_text,
                    original_message=final_message,
                    request=request
                )
                print(f"[ADMIN] Stored external component result to provenance: {llm_prov.event_id}")
            except Exception as e:
                print(f"[ADMIN] Error storing external result to provenance: {e}")

            # Step 5: chat ai -> Orch (publish llm_response_ready BEFORE output policy)
            await event_bus.publish({
                "type": "llm_response_ready",
                "trace_id": resp.trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "trace_id": resp.trace_id,
                    "message_id": message_id,
                    "original_message": original_message,
                    "effective_message": final_message,
                    "reply": reply_text,
                    "component_id": component_id,
                    "timestamp": iso_utc_now(),
                }
            })

            # Output policy evaluation (steps 6 & 7)
            output_eval_data = None
            try:
                from services.policy_engine import policy_engine
                await event_bus.publish({
                    "type": "policy_check_request",
                    "trace_id": resp.trace_id,
                    "ts": int(time.time() * 1000),
                    "data": {
                        "message_id": message_id,
                        "policy_type": "output",
                        "envelope_type": "policy.output",
                        "action": "message.output.evaluate",
                        "context": {
                            "original_message": final_message,
                            "history": [h.model_dump() for h in (msg.history or [])] if msg and msg.history else []
                        },
                        "payload": {"content": reply_text},
                        "dry_run": False,
                    }
                })
                output_eval = await policy_engine.evaluate_content(
                    content=reply_text,
                    policy_type="output",
                    context={
                        "original_message": final_message,
                        "history": [h.model_dump() for h in (msg.history or [])] if msg and msg.history else []
                    }
                )
                output_eval_data = {
                    "decision": output_eval.decision,
                    "passed": output_eval.passed,
                    "violations": [v.model_dump() for v in output_eval.violations],
                    "summary": output_eval.summary,
                    "evaluation_time_ms": output_eval.evaluation_time_ms,
                    "evaluated_policies": output_eval.evaluated_policies,
                }
                await message_queue.store_policy_evaluation(message_id, "output", output_eval_data)
                await event_bus.publish({
                    "type": "policy_evaluation",
                    "trace_id": resp.trace_id,
                    "ts": int(time.time() * 1000),
                    "data": {
                        "message_id": message_id,
                        "policy_type": "output",
                        **output_eval_data,
                    }
                })
            except Exception as e:
                print(f"[ADMIN] Error evaluating output policies: {e}")

            # Step 8a: Orch -> HITL (secondary review: admin sees AI response)
            await event_bus.publish({
                "type": "secondary_review_request",
                "trace_id": resp.trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "message_id": message_id,
                    "llm_response": reply_text,
                    "output_policy_evaluation": output_eval_data,
                    "timestamp": iso_utc_now(),
                }
            })

            return {
                "status": "awaiting_secondary_review",
                "message_id": message_id,
                "llm_response": reply_text,
                "trace_id": resp.trace_id,
                "output_policy_evaluation": output_eval_data,
            }

        # ── Normal (internal chat / Claude) path ─────────────────────────
        chat_req = ChatRequest(
            trace_id=resp.trace_id,
            message=final_message,
            history=msg.history if msg else None,
            max_tokens=1200,
            admin_prompt=admin_prompt,
        )

        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
        preview_messages = [
            *[{"role": h.role, "content": h.content} for h in (msg.history or [])],
            {"role": "user", "content": final_message},
        ]

        claude_request_preview: Dict[str, Any] = {
            "model": model,
            "max_tokens": chat_req.max_tokens,
            "messages": preview_messages,
        }
        if admin_prompt:
            claude_request_preview["system"] = admin_prompt

        envelope_id = str(uuid.uuid4())
        claude_request_envelope = ClaudeRequestEnvelope(
            jsonrpc="2.0",
            id=envelope_id,
            envelope_type="claudeRequest",
            params=claude_request_preview,
            _meta={
                "trace_id": resp.trace_id,
                "message_id": message_id,
                "timestamp": iso_utc_now(),
                "stage": "primary_approval",
            }
        )

        message_approved_data = {
            "trace_id": resp.trace_id,
            "message_id": message_id,
            "decision": "ALLOW",
            "reviewer": "admin",
            "original_message": original_message,
            "effective_message": final_message,
            "admin_prompt": admin_prompt,
            "timestamp": iso_utc_now(),
            "claude_request": claude_request_envelope.model_dump(),
            "meta": {
                "message_id": message_id,
                "approved_at": int(time.time() * 1000)
            }
        }

        await event_bus.publish({
            "type": "message_approved",
            "trace_id": resp.trace_id,
            "ts": int(time.time() * 1000),
            "data": message_approved_data
        })
        print(f"[ADMIN] Published message_approved event for {message_id}")

        try:
            execute_chat = get_execute_chat()
            chat_response = await execute_chat(chat_req, request)
            await message_queue.store_chat_response(message_id, chat_response)

            try:
                llm_prov = await store_llm_result_prov_event(
                    message_id=message_id,
                    trace_id=resp.trace_id,
                    llm_response=chat_response.reply,
                    original_message=final_message,
                    request=request
                )
                print(f"[ADMIN] Stored LLM result to provenance: {llm_prov.event_id}")
            except Exception as e:
                print(f"[ADMIN] Error storing LLM result to provenance: {e}")

            # Step 5: chat ai -> Orch (publish llm_response_ready BEFORE output policy)
            llm_response_data = {
                "trace_id": resp.trace_id,
                "message_id": message_id,
                "original_message": original_message,
                "effective_message": final_message,
                "admin_prompt": admin_prompt,
                "reply": chat_response.reply,
                "claude_model": chat_response.claude_model,
                "claude_request": chat_response.claude_request,
                "claude_response": chat_response.claude_response,
                "timings_ms": chat_response.timings_ms,
                "errors": chat_response.errors,
                "timestamp": iso_utc_now()
            }

            await event_bus.publish({
                "type": "llm_response_ready",
                "trace_id": resp.trace_id,
                "ts": int(time.time() * 1000),
                "data": llm_response_data
            })
            print(f"[ADMIN] Published llm_response_ready event for {message_id}")

            # ========== Output Policy Evaluation (steps 6 & 7) ==========
            output_eval_data = None
            try:
                from services.policy_engine import policy_engine
                print(f"[ADMIN] Evaluating output policies for {message_id}...")
                await event_bus.publish({
                    "type": "policy_check_request",
                    "trace_id": resp.trace_id,
                    "ts": int(time.time() * 1000),
                    "data": {
                        "message_id": message_id,
                        "policy_type": "output",
                        "envelope_type": "policy.output",
                        "action": "message.output.evaluate",
                        "context": {
                            "original_message": final_message,
                            "history": [h.model_dump() for h in (msg.history or [])] if msg and msg.history else []
                        },
                        "payload": {"content": chat_response.reply},
                        "dry_run": False,
                    }
                })
                output_eval = await policy_engine.evaluate_content(
                    content=chat_response.reply,
                    policy_type="output",
                    context={
                        "original_message": final_message,
                        "history": [h.model_dump() for h in (msg.history or [])] if msg and msg.history else []
                    }
                )
                output_eval_data = {
                    "decision": output_eval.decision,
                    "passed": output_eval.passed,
                    "violations": [v.model_dump() for v in output_eval.violations],
                    "summary": output_eval.summary,
                    "evaluation_time_ms": output_eval.evaluation_time_ms,
                    "evaluated_policies": output_eval.evaluated_policies,
                }
                # Store in message queue
                await message_queue.store_policy_evaluation(message_id, "output", output_eval_data)
                print(f"[ADMIN] Output policy result: {output_eval.decision}")

                # Publish output policy evaluation event
                await event_bus.publish({
                    "type": "policy_evaluation",
                    "trace_id": resp.trace_id,
                    "ts": int(time.time() * 1000),
                    "data": {
                        "message_id": message_id,
                        "policy_type": "output",
                        "decision": output_eval.decision,
                        "passed": output_eval.passed,
                        "violations": [v.model_dump() for v in output_eval.violations],
                        "summary": output_eval.summary,
                        "evaluation_time_ms": output_eval.evaluation_time_ms
                    }
                })
            except Exception as e:
                print(f"[ADMIN] Error evaluating output policies: {e}")

            # Step 8a: Orch -> HITL (secondary review: admin sees AI response)
            await event_bus.publish({
                "type": "secondary_review_request",
                "trace_id": resp.trace_id,
                "ts": int(time.time() * 1000),
                "data": {
                    "message_id": message_id,
                    "llm_response": chat_response.reply,
                    "output_policy_evaluation": output_eval_data,
                    "timestamp": iso_utc_now(),
                }
            })

            return {
                "status": "awaiting_secondary_review",
                "message_id": message_id,
                "llm_response": chat_response.reply,
                "trace_id": resp.trace_id,
                "output_policy_evaluation": output_eval_data,
            }

        except Exception as e:
            print(f"[ADMIN] Error processing chat: {str(e)}")
            traceback.print_exc()

            error_resp = ClientResponse(
                message_id=message_id,
                trace_id=resp.trace_id,
                status="rejected",
                reason=f"Error processing request: {str(e)}"
            )
            await message_queue.update_response(message_id, error_resp)
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=400, detail="Invalid decision")


@router.post("/secondary-review/{message_id}")
async def admin_secondary_review(
    message_id: str,
    review: SecondaryReviewDecision,
    request: Request
) -> Dict[str, str]:
    """Admin secondary review of LLM output."""
    print(f"[ADMIN-SECONDARY] Review for {message_id}: {review.action}")
    
    resp = await message_queue.get_response(message_id)
    if not resp:
        raise HTTPException(status_code=404, detail="Message not found")
    
    msg = await message_queue.get_message(message_id)
    original_message = msg.message if msg else ""
    
    effective_message = review.effective_message or original_message

    # Step 8b: HITL -> Orch (admin secondary decision sent back to orch)
    await event_bus.publish({
        "type": "hitl_admin_decision_output",
        "trace_id": resp.trace_id,
        "ts": int(time.time() * 1000),
        "data": {
            "message_id": message_id,
            "action": review.action,
            "reviewer": "admin",
            "reject_reason": review.reject_reason or None,
            "edited_content": review.edited_content or None,
            "timestamp": iso_utc_now(),
        }
    })

    cached_chat_response = await message_queue.get_chat_response(message_id)
    llm_response_envelope = None
    if cached_chat_response and cached_chat_response.claude_response:
        from services.meta_enrichment import build_meta
        llm_response_envelope = await build_meta(
            user_message=effective_message,
            chat_response=cached_chat_response,
        )
    # Build citation with policy violation info if present
    from models.provenance import PolicyViolationRef
    policy_violation_refs = None
    output_eval = await message_queue.get_policy_evaluation(message_id, "output")
    if output_eval and output_eval.get("violations"):
        policy_violation_refs = [
            PolicyViolationRef(
                policy_name=v.get("policy_name", ""),
                rule_name=v.get("rule_name", ""),
                severity=v.get("severity", ""),
                reason=v.get("reason", ""),
                suggestion=v.get("suggestion"),
                source=v.get("policy_id"),
            )
            for v in output_eval["violations"]
        ]

    citation_reason = review.reject_reason or "LLM response reviewed"
    if policy_violation_refs and review.action in ("APPROVE", "EDIT"):
        citation_reason = f"Approved with policy warnings: {output_eval.get('summary', '')}"

    citation = review.citation or Citation(
        reason=citation_reason,
        references=None,
        reviewer="admin",
        timestamp=iso_utc_now(),
        decision_type=f"secondary_{review.action.lower()}",
        policy_violations=policy_violation_refs,
    )

    if review.action == "REJECT":
        updated_resp = ClientResponse(
            message_id=message_id,
            trace_id=resp.trace_id,
            status="rejected",
            error_code=review.error_code,
            citation=citation,
            reason=review.reject_reason or "LLM response rejected by administrator"
        )
        await message_queue.update_response(message_id, updated_resp)
        
        try:
            hitl_prov = await store_hitl_decision_prov_event(
                message_id=f"{message_id}-secondary",
                trace_id=resp.trace_id,
                decision="DENY",
                reviewer="admin",
                comments=f"LLM output rejected: {review.reject_reason}",
                override_reason="llm_output_review",
                original_message=effective_message,
                request=request,
                override_message=None,
                admin_prompt=review.admin_prompt,
            )
            print(f"[ADMIN-SECONDARY] Stored secondary rejection: {hitl_prov.event_id}")
        except Exception as e:
            print(f"[ADMIN-SECONDARY] Error storing secondary rejection: {e}")
        
        rejection_trace_data = {
            "trace_id": resp.trace_id,
            "message_id": message_id,
            "decision": "DENY",
            "reviewer": "admin",
            "error_code": review.error_code,
            "reason": review.reject_reason or "LLM response rejected",
            "original_message": effective_message,
            "timestamp": iso_utc_now(),
            "review_type": "secondary_review_rejected",
            "llm_response": llm_response_envelope
        }
        
        await event_bus.publish({
            "type": "hitl_decision",
            "trace_id": resp.trace_id,
            "ts": int(time.time() * 1000),
            "data": rejection_trace_data
        })
        
        print(f"[ADMIN-SECONDARY] Rejected LLM response for {message_id}")
        return {"status": "rejected", "message_id": message_id}

    elif review.action == "EDIT":
        if not review.edited_content:
            raise HTTPException(status_code=400, detail="Edited content required for EDIT action")
        
        completed_resp = ClientResponse(
            message_id=message_id,
            trace_id=resp.trace_id,
            status="completed",
            citation=citation,
            reply=review.edited_content
        )
        await message_queue.update_response(message_id, completed_resp)
        
        try:
            hitl_prov = await store_final_response_prov_event(
                message_id=f"{message_id}-final-edited",
                trace_id=resp.trace_id,
                final_response=review.edited_content,
                original_message=effective_message,
                edit_type="admin_edited",
                reviewer="admin",
                request=request
            )
            print(f"[ADMIN-SECONDARY] Stored edited response: {hitl_prov.event_id}")
        except Exception as e:
            print(f"[ADMIN-SECONDARY] Error storing edited response: {e}")
        
        edit_trace_data = {
            "trace_id": resp.trace_id,
            "message_id": message_id,
            "decision": "ALLOW",
            "reviewer": "admin",
            "reason": "LLM output edited by admin",
            "original_message": effective_message,
            "edited_content": review.edited_content,
            "timestamp": iso_utc_now(),
            "review_type": "secondary_review_edited",
            "llm_response": llm_response_envelope
        }
        
        await event_bus.publish({
            "type": "hitl_decision",
            "trace_id": resp.trace_id,
            "ts": int(time.time() * 1000),
            "data": edit_trace_data
        })
        
        print(f"[ADMIN-SECONDARY] Approved edited response for {message_id}")
        return {"status": "completed", "message_id": message_id}

    elif review.action == "APPROVE":
        if not review.edited_content:
            raise HTTPException(status_code=400, detail="LLM response content required for APPROVE action")
        
        completed_resp = ClientResponse(
            message_id=message_id,
            trace_id=resp.trace_id,
            status="completed",
            citation=citation,
            reply=review.edited_content
        )
        await message_queue.update_response(message_id, completed_resp)
        
        try:
            hitl_prov = await store_final_response_prov_event(
                message_id=f"{message_id}-final-approved",
                trace_id=resp.trace_id,
                final_response=review.edited_content,
                original_message=effective_message,
                edit_type="admin_approved_original",
                reviewer="admin",
                request=request
            )
            print(f"[ADMIN-SECONDARY] Stored approved response: {hitl_prov.event_id}")
        except Exception as e:
            print(f"[ADMIN-SECONDARY] Error storing approved response: {e}")
        
        approval_trace_data = {
            "trace_id": resp.trace_id,
            "message_id": message_id,
            "decision": "ALLOW",
            "reviewer": "admin",
            "reason": "LLM output approved without modification",
            "original_message": effective_message,
            "approved_content": review.edited_content,
            "timestamp": iso_utc_now(),
            "review_type": "secondary_review_approved",
            "llm_response": llm_response_envelope
        }
        
        await event_bus.publish({
            "type": "hitl_decision",
            "trace_id": resp.trace_id,
            "ts": int(time.time() * 1000),
            "data": approval_trace_data
        })
        
        print(f"[ADMIN-SECONDARY] Approved original LLM response for {message_id}")
        return {"status": "completed", "message_id": message_id}

    raise HTTPException(status_code=400, detail="Invalid action")


@router.get("/policy-evaluation/{message_id}")
async def get_policy_evaluation(
    message_id: str,
    policy_type: str | None = None,
) -> Dict[str, Any]:
    """Get stored policy evaluation results for a message."""
    result = await message_queue.get_policy_evaluation(message_id, policy_type)
    if result is None:
        return {"message_id": message_id, "policy_evaluation": None}
    return {"message_id": message_id, "policy_evaluation": result}


@router.post("/regenerate/{message_id}")
async def admin_regenerate(
    message_id: str,
    req: RegenerateRequest,
    request: Request
) -> Dict[str, Any]:
    """Regenerate AI response with new admin prompt."""
    print(f"[ADMIN-REGENERATE] Regenerate for {message_id}")
    print(f"[ADMIN-REGENERATE] Message: {req.message[:50]}...")
    print(f"[ADMIN-REGENERATE] Admin prompt: {req.admin_prompt[:50] if req.admin_prompt else 'None'}...")
    
    chat_req = ChatRequest(
        trace_id=req.trace_id,
        message=req.message,
        history=None,
        max_tokens=1200,
        admin_prompt=req.admin_prompt,
    )
    
    try:
        execute_chat = get_execute_chat()
        chat_response = await execute_chat(chat_req, request)
        
        print(f"[ADMIN-REGENERATE] Successfully regenerated response: {chat_response.reply[:50]}...")
        
        usage = None
        if chat_response.claude_response:
            if isinstance(chat_response.claude_response, dict):
                usage = chat_response.claude_response.get("usage")
            elif hasattr(chat_response.claude_response, "usage"):
                usage_obj = getattr(chat_response.claude_response, "usage")
                if hasattr(usage_obj, "model_dump"):
                    usage = usage_obj.model_dump()
                elif hasattr(usage_obj, "__dict__"):
                    usage = vars(usage_obj)
        
        return {
            "status": "success",
            "llm_response": chat_response.reply,
            "claude_model": chat_response.claude_model,
            "usage": usage
        }
        
    except Exception as e:
        print(f"[ADMIN-REGENERATE] Error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
