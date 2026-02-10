"""
MCP (Model Context Protocol) module management API endpoints.
"""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Request

from models.mcp import MCPServerConfig, MCPServerInfo, MCPServerDetailedInfo
from services.mcp_manager import mcp_manager

router = APIRouter(prefix="/api/modules", tags=["MCP Modules"])


@router.get("/mcp-servers", response_model=List[MCPServerInfo])
async def list_mcp_servers() -> List[MCPServerInfo]:
    """Get all MCP servers."""
    return await mcp_manager.list_servers()


@router.post("/mcp-servers", response_model=MCPServerInfo)
async def register_mcp_server(config: MCPServerConfig) -> MCPServerInfo:
    """Register a new MCP server."""
    await mcp_manager.register_server(
        server_id=config.server_id,
        name=config.name,
        script_path=config.script_path,
        description=config.description,
        python_cmd=config.python_cmd,
        env_vars=config.env_vars
    )
    return await mcp_manager.get_server_info(config.server_id)


@router.delete("/mcp-servers/{server_id}")
async def unregister_mcp_server(server_id: str) -> Dict[str, str]:
    """Unregister an MCP server."""
    await mcp_manager.unregister_server(server_id)
    return {"status": "success", "message": f"Server {server_id} unregistered"}


@router.post("/mcp-servers/{server_id}/connect", response_model=MCPServerInfo)
async def connect_mcp_server(server_id: str) -> MCPServerInfo:
    """Connect to an MCP server."""
    await mcp_manager.connect_server(server_id)
    return await mcp_manager.get_server_info(server_id)


@router.post("/mcp-servers/{server_id}/disconnect", response_model=MCPServerInfo)
async def disconnect_mcp_server(server_id: str) -> MCPServerInfo:
    """Disconnect from an MCP server."""
    await mcp_manager.disconnect_server(server_id)
    return await mcp_manager.get_server_info(server_id)


@router.get("/mcp-servers/{server_id}", response_model=MCPServerInfo)
async def get_mcp_server_info(server_id: str) -> MCPServerInfo:
    """Get MCP server details."""
    return await mcp_manager.get_server_info(server_id)


@router.get("/mcp-servers/{server_id}/tools")
async def get_mcp_server_tools(server_id: str) -> Dict[str, Any]:
    """Get MCP server tool details."""
    tools_detail = await mcp_manager.get_tool_details(server_id)
    return {
        "server_id": server_id,
        "tools": tools_detail,
        "count": len(tools_detail)
    }


@router.get("/mcp-servers/{server_id}/detailed", response_model=MCPServerDetailedInfo)
async def get_mcp_server_detailed_info(server_id: str) -> MCPServerDetailedInfo:
    """Get detailed MCP server info (including resources, tools, prompts)."""
    return await mcp_manager.get_detailed_info(server_id)


@router.post("/mcp-servers/{server_id}/tools/{tool_name}/toggle")
async def toggle_mcp_tool(
    server_id: str,
    tool_name: str,
    request: Request
) -> Dict[str, Any]:
    """Toggle tool enabled status."""
    body = await request.json()
    enabled = body.get("enabled", True)
    
    await mcp_manager.set_tool_enabled(server_id, tool_name, enabled)
    
    return {
        "status": "success",
        "server_id": server_id,
        "tool_name": tool_name,
        "enabled": enabled
    }
