"""
Registry models for system components.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


ModuleType = Literal["frontend", "backend", "llm", "database", "service", "mcp_server", "mcp_tool"]
ModuleStatus = Literal["running", "connected", "configured", "disconnected", "error", "unknown"]


class ModuleMeta(BaseModel):
    """Metadata for a module."""
    version: Optional[str] = None
    framework: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    database: Optional[str] = None
    collection: Optional[str] = None
    endpoint: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class RegistryModule(BaseModel):
    """A single module in the registry."""
    id: str
    name: str
    type: ModuleType
    status: ModuleStatus
    description: Optional[str] = None
    configurable: bool = False
    enabled: bool = True
    meta: Optional[ModuleMeta] = None
    error_message: Optional[str] = None


class MCPToolInfo(BaseModel):
    """Information about an MCP tool."""
    name: str
    description: Optional[str] = None
    enabled: bool = True
    input_schema: Optional[Dict[str, Any]] = None
    server_id: str
    server_name: str


class MCPServerWithTools(BaseModel):
    """MCP server with its tools."""
    server_id: str
    name: str
    status: ModuleStatus
    description: Optional[str] = None
    script_path: Optional[str] = None
    tools: List[MCPToolInfo] = []
    tool_count: int = 0
    error_message: Optional[str] = None


class RegistryCategory(BaseModel):
    """A category of modules."""
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None  # For frontend rendering
    configurable: bool = False
    modules: List[RegistryModule] = []


class MCPCategory(BaseModel):
    """Special category for MCP tools."""
    id: str = "mcp-tools"
    name: str = "MCP Tools"
    description: str = "Model Context Protocol servers and tools"
    icon: str = "wrench"
    configurable: bool = True
    servers: List[MCPServerWithTools] = []
    total_tools: int = 0
    enabled_tools: int = 0


class RegistryResponse(BaseModel):
    """Full registry response."""
    categories: List[RegistryCategory] = []
    mcp: Optional[MCPCategory] = None
    total_modules: int = 0
    total_tools: int = 0
