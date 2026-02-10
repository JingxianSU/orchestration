"""
Human-in-the-Loop (HITL) request/response store.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel

from models.chat import HistoryItem


class HITLRequest(BaseModel):
    """HITL review request."""
    trace_id: str
    message: str
    history: Optional[List[HistoryItem]] = None
    meta: Optional[Dict[str, Any]] = None


class HITLResponse(BaseModel):
    """HITL review response."""
    decision: Literal["ALLOW", "DENY"]
    reason: Optional[str] = None


class HITLStore:
    """In-memory store for HITL requests and responses."""
    
    def __init__(self) -> None:
        self._pending: Dict[str, HITLRequest] = {}
        self._responses: Dict[str, HITLResponse] = {}
        self._lock = asyncio.Lock()

    async def store_request(self, req: HITLRequest) -> None:
        """Store a pending HITL request."""
        async with self._lock:
            self._pending[req.trace_id] = req

    async def get_pending_request(self, trace_id: str) -> Optional[HITLRequest]:
        """Get a pending HITL request."""
        async with self._lock:
            return self._pending.get(trace_id)

    async def store_response(self, trace_id: str, resp: HITLResponse) -> None:
        """Store HITL response and remove from pending."""
        async with self._lock:
            if trace_id in self._pending:
                del self._pending[trace_id]
            self._responses[trace_id] = resp

    async def get_response(self, trace_id: str) -> Optional[HITLResponse]:
        """Get HITL response."""
        async with self._lock:
            return self._responses.get(trace_id)

    async def clear_response(self, trace_id: str) -> None:
        """Clear HITL response."""
        async with self._lock:
            if trace_id in self._responses:
                del self._responses[trace_id]


# Singleton instance
hitl_store = HITLStore()
