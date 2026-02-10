"""
Provenance-related Pydantic models.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


# Type aliases for clarity
OrchId = str
OrchSessionId = str
OrchTraceId = str


class Citation(BaseModel):
    """Citation/reference information for decisions."""
    reason: str
    references: Optional[List[str]] = None
    reviewer: Optional[str] = None
    timestamp: Optional[str] = None
    decision_type: Optional[str] = None


class ProvEvent(BaseModel):
    """A single provenance event."""
    event_id: OrchId
    session_id: Optional[OrchSessionId] = None
    trace_id: Optional[OrchTraceId] = None
    timestamp: str
    actor: str
    module_id: str
    envelope_type: str
    input_ref: Optional[Dict[str, Any]] = None
    output_ref: Optional[Dict[str, Any]] = None
    policy_ref: Optional[Dict[str, Any]] = None
    risk: Optional[str] = None
    status: Literal["SUCCESS", "ERROR"]
    prev_event_hash: Optional[str] = None
    event_hash: str
    ledger_anchor: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class ProvListItem(BaseModel):
    """Provenance event in list format."""
    event_id: str
    session_id: Optional[str] = None
    trace_id: Optional[str] = None
    timestamp: str
    actor: str
    module_id: str
    envelope_type: str
    status: Literal["SUCCESS", "ERROR"]
    prev_event_hash: Optional[str] = None
    event_hash: str
    ledger_anchor: Optional[str] = None
    timestamp_ms: int


class ProvListResponse(BaseModel):
    """Response for listing provenance events."""
    items: List[ProvListItem]
    next_cursor: Optional[str] = None


class PolicyEvaluateResult(BaseModel):
    """Result of policy evaluation."""
    decision: Literal["ALLOW", "PARTIAL_ALLOW", "DENY", "HITL_REQUIRED", "ESCALATION_REQUIRED"]
    constraints: Optional[List[str]] = None
    requires_hitl: bool = True
    residual_risk: Optional[str] = None
    policy_binding_id: str
    citation: Optional[Citation] = None


class RawMessageRequest(BaseModel):
    """Request to store raw message in provenance."""
    message_id: str
    trace_id: str
    message: str
    history: Optional[List[Dict[str, Any]]] = None
    meta: Optional[Dict[str, Any]] = None
