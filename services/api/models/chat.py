"""
Chat-related Pydantic models.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


Role = Literal["user", "assistant"]


class HistoryItem(BaseModel):
    """A single message in conversation history."""
    role: Role
    content: str


class ChatRequest(BaseModel):
    """Request to chat with Claude."""
    trace_id: Optional[str] = None
    message: str = Field(..., min_length=1)
    history: Optional[List[HistoryItem]] = None
    max_tokens: int = Field(default=512, ge=1, le=4096)
    use_medical_mcp: Optional[bool] = None
    mcp_tool: Optional[str] = None
    mcp_args: Optional[Dict[str, Any]] = None
    admin_prompt: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from Claude chat."""
    trace_id: str
    reply: str
    claude_model: Optional[str] = None
    claude_request: Optional[Dict[str, Any]] = None
    claude_response: Optional[Dict[str, Any]] = None  # Envelope format
    timings_ms: Optional[Dict[str, int]] = None
    errors: Optional[List[str]] = None
    # MCP tool-use loop records
    mcp_tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_use_rounds: int = 0
