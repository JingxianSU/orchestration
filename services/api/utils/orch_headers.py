"""
Orchestration header handling utilities.
"""
from __future__ import annotations

from typing import Dict, Optional

from fastapi import Request


def _lower_headers(headers: Dict[str, str]) -> Dict[str, str]:
    """Convert header keys to lowercase."""
    return {k.lower(): v for k, v in headers.items()}


def extract_orch_headers_from_request(req: Request) -> Dict[str, Optional[str]]:
    """Extract orchestration headers from incoming request."""
    h = _lower_headers(dict(req.headers))
    return {
        "id": h.get("orch-id"),
        "caller": h.get("orch-caller"),
        "module_id": h.get("orch-module-id"),
        "session_id": h.get("orch-session-id"),
        "policy_binding": h.get("orch-policy-binding"),
        "decision": h.get("orch-decision"),
        "risk_level": h.get("orch-risk-level"),
        "hitl_required": h.get("orch-hitl-required"),
        "event_hash": h.get("orch-event-hash"),
        "prev_event_hash": h.get("orch-prev-event-hash"),
        "ledger_anchor": h.get("orch-ledger-anchor"),
    }


def build_response_orch_headers(
    *,
    trace_id: str,
    request: Request,
    event_hash: Optional[str],
    prev_event_hash: Optional[str],
    ledger_anchor: Optional[str],
    policy_binding: Optional[str] = None,
    decision: Optional[str] = None,
    risk_level: Optional[str] = None,
    hitl_required: Optional[bool] = None,
) -> Dict[str, str]:
    """Build orchestration headers for outgoing response."""
    orch = extract_orch_headers_from_request(request)
    out: Dict[str, str] = {"Orch-Id": orch.get("id") or trace_id}
    
    if orch.get("caller"):
        out["Orch-Caller"] = orch["caller"] or ""
    if orch.get("module_id"):
        out["Orch-Module-Id"] = orch["module_id"] or ""
    if orch.get("session_id"):
        out["Orch-Session-Id"] = orch["session_id"] or ""
    if policy_binding:
        out["Orch-Policy-Binding"] = policy_binding
    if decision:
        out["Orch-Decision"] = decision
    if risk_level:
        out["Orch-Risk-Level"] = risk_level
    if hitl_required is not None:
        out["Orch-HITL-Required"] = str(hitl_required).lower()
    if event_hash:
        out["Orch-Event-Hash"] = event_hash
    if prev_event_hash:
        out["Orch-Prev-Event-Hash"] = prev_event_hash
    if ledger_anchor:
        out["Orch-Ledger-Anchor"] = ledger_anchor
    
    return out
