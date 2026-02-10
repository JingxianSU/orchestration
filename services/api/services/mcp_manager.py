"""
Dynamic MCP (Model Context Protocol) server manager.
"""
from __future__ import annotations

import asyncio
import os
import shutil
from contextlib import AsyncExitStack
from typing import Any, Dict, List, Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from models.mcp import MCPServerInfo, MCPServerDetailedInfo
from utils.helpers import obj_to_jsonable


class MCPManager:
    """Manager for dynamically registering and connecting to MCP servers."""
    
    def __init__(self) -> None:
        self._servers: Dict[str, Dict[str, Any]] = {}
        self._sessions: Dict[str, ClientSession] = {}
        self._exit_stacks: Dict[str, AsyncExitStack] = {}
        self._tool_configs: Dict[str, Dict[str, bool]] = {}
        self._lock = asyncio.Lock()

    async def register_server(
        self,
        server_id: str,
        name: str,
        script_path: str,
        description: Optional[str] = None,
        python_cmd: Optional[str] = None,
        env_vars: Optional[Dict[str, str]] = None
    ) -> None:
        """Register a new MCP server."""
        async with self._lock:
            if server_id in self._servers:
                raise ValueError(f"Server {server_id} already registered")
            
            self._servers[server_id] = {
                "server_id": server_id,
                "name": name,
                "script_path": os.path.abspath(script_path),
                "description": description,
                "python_cmd": python_cmd or os.getenv("BACKEND_PYTHON") or shutil.which("python") or "python",
                "env_vars": env_vars or {},
                "enabled": False,
                "status": "disconnected",
                "tools": [],
                "resources": [],
                "prompts": [],
                "registered_at": int(asyncio.get_event_loop().time() * 1000),
                "last_connected": None,
                "error_message": None
            }
            self._tool_configs[server_id] = {}
            print(f"[MCP-MANAGER] Registered server: {server_id} ({name})")

    async def connect_server(self, server_id: str) -> None:
        """Connect to an MCP server."""
        async with self._lock:
            if server_id not in self._servers:
                raise ValueError(f"Server {server_id} not found")
            
            if server_id in self._sessions:
                print(f"[MCP-MANAGER] Server {server_id} already connected")
                return
            
            server = self._servers[server_id]
            
            try:
                script_path = server["script_path"]
                python_cmd = server["python_cmd"]
                
                if not script_path.endswith(".py"):
                    raise RuntimeError(f"Only .py MCP servers are supported: {script_path}")
                
                env = os.environ.copy()
                env.update(server["env_vars"])
                
                app_dir = os.path.dirname(script_path)
                pyroot = os.getenv("MCP_PYROOT") or os.path.abspath(os.path.join(app_dir, os.pardir))
                existing = env.get("PYTHONPATH", "")
                env["PYTHONPATH"] = pyroot if not existing else f"{pyroot}{os.pathsep}{existing}"
                
                params = StdioServerParameters(command=python_cmd, args=[script_path], env=env)
                
                exit_stack = AsyncExitStack()
                self._exit_stacks[server_id] = exit_stack
                
                stdio_transport = await exit_stack.enter_async_context(stdio_client(params))
                stdio, write = stdio_transport
                session = await exit_stack.enter_async_context(ClientSession(stdio, write))
                await session.initialize()
                
                self._sessions[server_id] = session
                
                # Get tools
                tools_resp = await session.list_tools()
                tools = [t.name for t in tools_resp.tools]
                tools_detail = [{
                    "name": t.name,
                    "description": getattr(t, "description", None),
                    "inputSchema": obj_to_jsonable(getattr(t, "inputSchema", None))
                } for t in tools_resp.tools]
                
                # Get resources
                resources_detail = []
                try:
                    resources_resp = await session.list_resources()
                    resources_detail = [{
                        "uri": r.uri,
                        "name": getattr(r, "name", None),
                        "description": getattr(r, "description", None),
                        "mimeType": getattr(r, "mimeType", None)
                    } for r in resources_resp.resources]
                except Exception:
                    pass
                
                # Get prompts
                prompts_detail = []
                try:
                    prompts_resp = await session.list_prompts()
                    prompts_detail = [{
                        "name": p.name,
                        "description": getattr(p, "description", None),
                        "arguments": obj_to_jsonable(getattr(p, "arguments", None))
                    } for p in prompts_resp.prompts]
                except Exception:
                    pass
                
                # Initialize tool configs
                for tool_name in tools:
                    if tool_name not in self._tool_configs[server_id]:
                        self._tool_configs[server_id][tool_name] = True
                
                server["enabled"] = True
                server["status"] = "connected"
                server["tools"] = tools_detail
                server["resources"] = resources_detail
                server["prompts"] = prompts_detail
                server["last_connected"] = int(asyncio.get_event_loop().time() * 1000)
                server["error_message"] = None
                
                print(f"[MCP-MANAGER] Connected to {server_id}: {len(tools)} tools")
                
            except Exception as e:
                server["status"] = "error"
                server["error_message"] = str(e)
                print(f"[MCP-MANAGER] Failed to connect to {server_id}: {e}")
                raise

    async def disconnect_server(self, server_id: str) -> None:
        """Disconnect from an MCP server."""
        async with self._lock:
            if server_id not in self._servers:
                raise ValueError(f"Server {server_id} not found")
            await self._disconnect_server_internal(server_id)
            print(f"[MCP-MANAGER] Disconnected from {server_id}")

    async def _disconnect_server_internal(self, server_id: str) -> None:
        """Internal disconnect (must hold lock)."""
        if server_id in self._exit_stacks:
            await self._exit_stacks[server_id].aclose()
            del self._exit_stacks[server_id]
        
        if server_id in self._sessions:
            del self._sessions[server_id]
        
        if server_id in self._servers:
            self._servers[server_id]["enabled"] = False
            self._servers[server_id]["status"] = "disconnected"
            self._servers[server_id]["tools"] = []

    async def unregister_server(self, server_id: str) -> None:
        """Unregister an MCP server."""
        async with self._lock:
            if server_id not in self._servers:
                raise ValueError(f"Server {server_id} not found")
            
            if server_id in self._sessions:
                await self._disconnect_server_internal(server_id)
            
            del self._servers[server_id]
            if server_id in self._tool_configs:
                del self._tool_configs[server_id]
            print(f"[MCP-MANAGER] Unregistered server: {server_id}")

    async def list_servers(self) -> List[MCPServerInfo]:
        """List all registered MCP servers."""
        async with self._lock:
            result = []
            for s in self._servers.values():
                tools_list = s.get("tools", [])
                if tools_list and isinstance(tools_list[0], dict):
                    tool_names = [t.get("name", "") for t in tools_list]
                else:
                    tool_names = list(tools_list)
                
                result.append(MCPServerInfo(
                    server_id=s["server_id"],
                    name=s["name"],
                    script_path=s["script_path"],
                    description=s.get("description"),
                    status=s["status"],
                    enabled=s["enabled"],
                    tools=tool_names,
                    registered_at=s["registered_at"],
                    last_connected=s.get("last_connected"),
                    error_message=s.get("error_message")
                ))
            return result

    async def get_server_info(self, server_id: str) -> MCPServerInfo:
        """Get info for a single MCP server."""
        async with self._lock:
            if server_id not in self._servers:
                raise ValueError(f"Server {server_id} not found")
            
            s = self._servers[server_id]
            tools_list = s.get("tools", [])
            if tools_list and isinstance(tools_list[0], dict):
                tool_names = [t.get("name", "") for t in tools_list]
            else:
                tool_names = list(tools_list)
            
            return MCPServerInfo(
                server_id=s["server_id"],
                name=s["name"],
                script_path=s["script_path"],
                description=s.get("description"),
                status=s["status"],
                enabled=s["enabled"],
                tools=tool_names,
                registered_at=s["registered_at"],
                last_connected=s.get("last_connected"),
                error_message=s.get("error_message")
            )

    async def get_detailed_info(self, server_id: str) -> MCPServerDetailedInfo:
        """Get detailed info for an MCP server."""
        async with self._lock:
            if server_id not in self._servers:
                raise ValueError(f"Server {server_id} not found")
            
            s = self._servers[server_id]
            tool_configs = self._tool_configs.get(server_id, {})
            
            return MCPServerDetailedInfo(
                server_id=s["server_id"],
                name=s["name"],
                script_path=s["script_path"],
                description=s.get("description"),
                status=s["status"],
                enabled=s["enabled"],
                registered_at=s["registered_at"],
                last_connected=s.get("last_connected"),
                error_message=s.get("error_message"),
                resources=s.get("resources", []),
                tools=s.get("tools", []),
                prompts=s.get("prompts", []),
                tool_configs=tool_configs
            )

    async def call_tool(self, server_id: str, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool on an MCP server."""
        async with self._lock:
            if server_id not in self._sessions:
                raise ValueError(f"Server {server_id} not connected")
            session = self._sessions[server_id]
        
        result = await session.call_tool(tool_name, arguments=arguments)
        return obj_to_jsonable(result)

    async def get_tool_details(self, server_id: str) -> List[Dict[str, Any]]:
        """Get detailed tool information for an MCP server."""
        async with self._lock:
            if server_id not in self._sessions:
                raise ValueError(f"Server {server_id} not connected")
            session = self._sessions[server_id]
        
        resp = await session.list_tools()
        return [{
            "name": tool.name,
            "description": getattr(tool, "description", None),
            "inputSchema": obj_to_jsonable(getattr(tool, "inputSchema", None))
        } for tool in resp.tools]

    async def get_tools_for_claude(self) -> tuple[List[Dict[str, Any]], Dict[str, str]]:
        """Return (tools_list, tool_to_server) for the Claude API ``tools`` param.

        ``tools_list`` – list of dicts in Anthropic tool-use format::

            {"name": "...", "description": "...", "input_schema": {...}}

        ``tool_to_server`` – mapping ``tool_name -> server_id`` so the caller
        knows which MCP server to dispatch each tool call to.

        Only enabled tools on connected servers are included.
        """
        async with self._lock:
            tools_list: List[Dict[str, Any]] = []
            tool_to_server: Dict[str, str] = {}

            for sid, s in self._servers.items():
                if s["status"] != "connected":
                    continue
                tool_configs = self._tool_configs.get(sid, {})
                for t in s.get("tools", []):
                    if not isinstance(t, dict):
                        continue
                    t_name = t.get("name", "")
                    if not tool_configs.get(t_name, True):
                        continue  # tool disabled
                    tools_list.append({
                        "name": t_name,
                        "description": t.get("description") or "",
                        "input_schema": t.get("inputSchema") or {"type": "object"},
                    })
                    tool_to_server[t_name] = sid

            return tools_list, tool_to_server

    async def get_servers_summary(self) -> List[Dict[str, Any]]:
        """Get a summary of all connected servers and their enabled tools.

        Returns a list of dicts:
        [{"server_id": ..., "name": ..., "status": ..., "tools": [{"name": ..., "enabled": bool}]}]
        """
        async with self._lock:
            result = []
            for sid, s in self._servers.items():
                tools_list = s.get("tools", [])
                tool_configs = self._tool_configs.get(sid, {})
                tools_info = []
                for t in tools_list:
                    t_name = t.get("name", t) if isinstance(t, dict) else str(t)
                    tools_info.append({
                        "name": t_name,
                        "description": t.get("description") if isinstance(t, dict) else None,
                        "enabled": tool_configs.get(t_name, True),
                    })
                result.append({
                    "server_id": sid,
                    "name": s["name"],
                    "status": s["status"],
                    "description": s.get("description"),
                    "tools": tools_info,
                })
            return result

    async def set_tool_enabled(self, server_id: str, tool_name: str, enabled: bool) -> None:
        """Set tool enabled status."""
        async with self._lock:
            if server_id not in self._servers:
                raise ValueError(f"Server {server_id} not found")
            if server_id not in self._tool_configs:
                self._tool_configs[server_id] = {}
            self._tool_configs[server_id][tool_name] = enabled

    async def close_all(self) -> None:
        """Close all connections."""
        async with self._lock:
            for server_id in list(self._servers.keys()):
                await self._disconnect_server_internal(server_id)


# Singleton instance
mcp_manager = MCPManager()
