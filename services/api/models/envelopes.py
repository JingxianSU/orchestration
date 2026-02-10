"""
Envelope wrapper models for Claude API requests/responses.
"""
from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel


class ClaudeRequestEnvelope(BaseModel):
    """Envelope wrapper for Claude requests."""
    jsonrpc: str = "2.0"
    id: str
    envelope_type: Literal["claudeRequest"]
    params: Dict[str, Any]
    _meta: Optional[Dict[str, Any]] = None


class ClaudeResponseEnvelope(BaseModel):
    """Envelope wrapper for Claude responses."""
    jsonrpc: str = "2.0"
    id: str
    envelope_type: Literal["claudeResponse"]
    result: Dict[str, Any]
    _meta: Optional[Dict[str, Any]] = None
