"""
Provenance API endpoints.
"""
from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

from models.provenance import ProvEvent, ProvListResponse, RawMessageRequest
from utils.helpers import iso_utc_now, sha256_hex, canonical_json_bytes
from utils.orch_headers import extract_orch_headers_from_request

router = APIRouter(prefix="/api/provenance", tags=["Provenance"])

# Get mongo instance lazily
_mongo = None

def get_mongo():
    global _mongo
    if _mongo is None:
        from db import MongoStore
        # This will be set from main.py
        pass
    return _mongo

def set_mongo(mongo):
    global _mongo
    _mongo = mongo


@router.get("", response_model=ProvListResponse)
async def list_provenance(
    limit: int = 50,
    cursor: Optional[str] = None,
    session_id: Optional[str] = None,
    trace_id: Optional[str] = None
) -> Any:
    """List provenance events with optional filters."""
    if limit < 1:
        limit = 1
    if limit > 200:
        limit = 200
    
    if not os.getenv("MONGODB_URI") or _mongo is None:
        return {"items": [], "next_cursor": None}
    
    docs, next_cursor = await _mongo.list_prov_events(
        limit=limit,
        cursor=cursor,
        session_id=session_id,
        trace_id=trace_id
    )
    
    items: List[Dict[str, Any]] = []
    for d in docs:
        prov = (d.get("provenance") or {}) if isinstance(d, dict) else {}
        items.append({
            "event_id": prov.get("event_id"),
            "session_id": prov.get("session_id"),
            "trace_id": prov.get("trace_id"),
            "timestamp": prov.get("timestamp"),
            "actor": prov.get("actor"),
            "module_id": prov.get("module_id"),
            "envelope_type": prov.get("envelope_type"),
            "status": prov.get("status"),
            "prev_event_hash": prov.get("prev_event_hash"),
            "event_hash": prov.get("event_hash"),
            "ledger_anchor": prov.get("ledger_anchor"),
            "timestamp_ms": int(d.get("timestamp_ms") or 0)
        })
    
    items = [x for x in items if x.get("event_id")]
    return {"items": items, "next_cursor": next_cursor}


@router.get("/{event_id}", response_model=ProvEvent)
async def get_provenance(event_id: str) -> Any:
    """Get a single provenance event by ID."""
    if not os.getenv("MONGODB_URI") or _mongo is None:
        raise HTTPException(status_code=404, detail="Provenance store not configured")
    
    doc = await _mongo.get_prov_event_by_event_id(event_id=event_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Provenance event not found")
    
    prov = doc.get("provenance")
    if not isinstance(prov, dict):
        raise HTTPException(status_code=500, detail="Invalid provenance document shape")
    
    return ProvEvent(**prov)


@router.post("/raw-message")
async def store_raw_message(
    req: RawMessageRequest,
    request: Request
) -> Dict[str, str]:
    """Store client's raw message to provenance."""
    
    print(f"[PROV-RAW] Received request:")
    print(f"  message_id: {req.message_id}")
    print(f"  trace_id: {req.trace_id}")
    print(f"  message: {req.message[:50]}...")
    
    if not os.getenv("MONGODB_URI") or _mongo is None:
        return {"status": "skipped", "reason": "MongoDB not configured"}
    
    if not req.message_id:
        return {"status": "error", "reason": "message_id is required"}
    if not req.trace_id:
        return {"status": "error", "reason": "trace_id is required"}
    if not req.message:
        return {"status": "error", "reason": "message is required"}
    
    try:
        orch = extract_orch_headers_from_request(request)
        event_id = req.message_id
        
        if not event_id:
            raise ValueError("event_id cannot be empty")
        
        print(f"[PROV-RAW] Using event_id: {event_id}")
        
        session_id = orch.get("session_id") or None
        actor = "client"
        module_id = "client-frontend"
        ledger_anchor = orch.get("ledger_anchor") or os.getenv("ORCH_LEDGER_ANCHOR") or None
        
        prev_hash: Optional[str] = None
        try:
            prev_hash = await _mongo.get_last_event_hash(
                session_id=session_id,
                trace_id=req.trace_id
            )
            print(f"[PROV-RAW] Previous hash: {prev_hash}")
        except Exception as e:
            print(f"[PROV-RAW] Could not get prev hash: {e}")
            prev_hash = None
        
        envelope_type = "ChatRawRequestEnvelope"
        timestamp = iso_utc_now()
        
        input_ref = {
            "message": req.message,
            "history": req.history or [],
            "meta": req.meta or {}
        }
        
        output_ref = None
        policy_ref = None
        
        preimage = {
            "event_id": event_id,
            "session_id": session_id,
            "trace_id": req.trace_id,
            "timestamp": timestamp,
            "actor": actor,
            "module_id": module_id,
            "envelope_type": envelope_type,
            "input_ref": input_ref,
            "output_ref": output_ref,
            "policy_ref": policy_ref,
            "risk": None,
            "status": "SUCCESS",
            "prev_event_hash": prev_hash,
            "ledger_anchor": ledger_anchor,
            "meta": {
                "message_id": req.message_id,
                "received_at": int(time.time() * 1000)
            }
        }
        
        event_hash = sha256_hex(canonical_json_bytes(preimage))
        print(f"[PROV-RAW] Computed event_hash: {event_hash}")
        
        prov = ProvEvent(
            event_id=event_id,
            session_id=session_id,
            trace_id=req.trace_id,
            timestamp=timestamp,
            actor=actor,
            module_id=module_id,
            envelope_type=envelope_type,
            input_ref=input_ref,
            output_ref=output_ref,
            policy_ref=policy_ref,
            risk=None,
            status="SUCCESS",
            prev_event_hash=prev_hash,
            event_hash=event_hash,
            ledger_anchor=ledger_anchor,
            meta=preimage["meta"]
        )
        
        prov_dict = prov.model_dump()
        if not prov_dict.get("event_id"):
            raise ValueError(f"ProvEvent has no event_id: {prov_dict}")
        
        print(f"[PROV-RAW] ProvEvent created successfully with event_id: {prov_dict['event_id']}")
        
        doc = {
            "provenance": prov_dict,
            "timestamp_ms": int(time.time() * 1000)
        }
        
        if not doc["provenance"].get("event_id"):
            raise ValueError(f"Document has no event_id before insert: {doc}")
        
        await _mongo.insert_prov_event(doc)
        
        print(f"[PROV-RAW] Successfully stored raw message event: {event_id}")
        
        return {
            "status": "success",
            "event_id": event_id,
            "event_hash": event_hash,
            "prev_event_hash": prev_hash or ""
        }
        
    except Exception as e:
        print(f"[PROV-RAW] Error storing raw message: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "reason": str(e)
        }
