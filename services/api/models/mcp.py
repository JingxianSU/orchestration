"""
MCP (Model Context Protocol) related Pydantic models.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


class MCPServerConfig(BaseModel):
    """Configuration for registering an MCP server."""
    server_id: str
    name: str
    script_path: str
    python_cmd: Optional[str] = None
    env_vars: Optional[Dict[str, str]] = None
    description: Optional[str] = None


class MCPServerInfo(BaseModel):
    """Information about an MCP server."""
    server_id: str
    name: str
    script_path: str
    description: Optional[str] = None
    status: Literal["connected", "disconnected", "error"]
    enabled: bool
    tools: List[str]
    registered_at: int
    last_connected: Optional[int] = None
    error_message: Optional[str] = None


class MCPServerDetailedInfo(BaseModel):
    """Detailed information about an MCP server."""
    server_id: str
    name: str
    script_path: str
    description: Optional[str] = None
    status: Literal["connected", "disconnected", "error"]
    enabled: bool
    registered_at: int
    last_connected: Optional[int] = None
    error_message: Optional[str] = None
    resources: List[Dict[str, Any]]
    tools: List[Dict[str, Any]]
    prompts: List[Dict[str, Any]]
    tool_configs: Dict[str, bool]  # tool_name -> enabled


class MCPToolConfig(BaseModel):
    """Configuration for an MCP tool."""
    name: str
    enabled: bool


class MCPToolCall(BaseModel):
    """Record of a single MCP tool call."""
    server_name: str
    tool: str
    args: Dict[str, Any]
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: Optional[int] = None


class RoutingDecision(BaseModel):
    """Routing decision information."""
    requires_mcp: bool
    reason: str
    suggested_servers: Optional[List[str]] = None
    router_model: Optional[str] = None
