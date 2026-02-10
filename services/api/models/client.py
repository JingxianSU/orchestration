"""
Client-facing Pydantic models.
"""
from __future__ import annotations

from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field

from .chat import HistoryItem
from .provenance import Citation


class ClientMessage(BaseModel):
    """Message from client awaiting review."""
    message_id: str
    trace_id: str
    message: str
    history: Optional[List[HistoryItem]] = None
    timestamp: int


class ClientMessageRequest(BaseModel):
    """Request to send a new client message."""
    message: str = Field(..., min_length=1)
    history: Optional[List[HistoryItem]] = None
    auto_approve: Optional[bool] = False


class ClientResponse(BaseModel):
    """Response status for client message.

    error_code can be:
    - A 7-digit status code string (e.g., "1111110")
    - A legacy string like "INPUT_POLICY_VIOLATION" for backwards compatibility
    """
    message_id: str
    trace_id: str
    status: Literal["pending", "approved", "rejected", "completed"]
    reply: Optional[str] = None
    reason: Optional[str] = None
    error_code: Optional[str] = None  # 7-digit status code or legacy string
    citation: Optional[Citation] = None
