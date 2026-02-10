"""
Admin-related Pydantic models.
"""
from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, field_validator

from .provenance import Citation
from .status_codes import is_valid_status_code


class AdminDecision(BaseModel):
    """Admin decision on a client message."""
    message_id: str
    trace_id: str
    decision: Literal["ALLOW", "DENY"]
    reason: Optional[str] = None
    error_code: Optional[str] = None  # 7-digit status code
    override_message: Optional[str] = None
    admin_prompt: Optional[str] = None
    citation: Optional[Citation] = None

    @field_validator("error_code")
    @classmethod
    def validate_error_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not is_valid_status_code(v):
            raise ValueError(f"Invalid 7-digit status code: {v}")
        return v


class SecondaryReviewDecision(BaseModel):
    """Admin secondary review decision on LLM output."""
    message_id: str
    trace_id: str
    action: Literal["APPROVE", "EDIT", "REJECT"]
    edited_content: Optional[str] = None
    reject_reason: Optional[str] = None
    effective_message: Optional[str] = None
    admin_prompt: Optional[str] = None
    error_code: Optional[str] = None  # 7-digit status code
    citation: Optional[Citation] = None

    @field_validator("error_code")
    @classmethod
    def validate_error_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not is_valid_status_code(v):
            raise ValueError(f"Invalid 7-digit status code: {v}")
        return v


class RegenerateRequest(BaseModel):
    """Request to regenerate AI response."""
    message_id: str
    trace_id: str
    message: str  # effective_message
    admin_prompt: Optional[str] = None
