"""
Registry API endpoints - System component registry.
"""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter

from models.registry import (
    RegistryResponse,
    RegistryCategory,
    RegistryModule,
    ModuleMeta,
    MCPCategory,
    MCPServerWithTools,
    MCPToolInfo,
)
from services.mcp_manager import mcp_manager
from config import settings

router = APIRouter(prefix="/api/registry", tags=["Registry"])


def get_infrastructure_category() -> RegistryCategory:
    """Get infrastructure modules (UI, API Gateway)."""
    modules = [
        RegistryModule(
            id="user-interface",
            name="Web Admin Dashboard",
            type="frontend",
            status="running",
            description="React-based administration interface for HITL workflow",
            configurable=False,
            enabled=True,
            meta=ModuleMeta(
                version="1.0.0",
                framework="React + TypeScript + Vite",
                endpoint="http://localhost:5173"
            )
        ),
        RegistryModule(
            id="api-gateway",
            name="Orchestration API",
            type="backend",
            status="running",
            description="FastAPI service for HITL workflow orchestration",
            configurable=False,
            enabled=True,
            meta=ModuleMeta(
                version="1.0.0",
                framework="FastAPI + Python",
                endpoint="http://localhost:8000"
            )
        ),
    ]
    
    return RegistryCategory(
        id="infrastructure",
        name="Infrastructure",
        description="Core system components and services",
        icon="server",
        configurable=False,
        modules=modules
    )


def get_ai_models_category() -> RegistryCategory:
    """Get AI model modules."""
    model = settings.CLAUDE_MODEL or os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
    api_key_configured = bool(settings.ANTHROPIC_API_KEY)
    
    modules = [
        RegistryModule(
            id="claude-api",
            name="Claude API",
            type="llm",
            status="configured" if api_key_configured else "disconnected",
            description="Anthropic Claude language model for AI responses",
            configurable=True,
            enabled=api_key_configured,
            meta=ModuleMeta(
                provider="Anthropic",
                model=model,
                version="API v1"
            ),
            error_message=None if api_key_configured else "ANTHROPIC_API_KEY not configured"
        ),
    ]
    
    return RegistryCategory(
        id="ai-models",
        name="AI Models",
        description="Language models and AI services",
        icon="brain",
        configurable=True,
        modules=modules
    )


def get_data_stores_category() -> RegistryCategory:
    """Get data store modules."""
    mongo_uri = os.getenv("MONGODB_URI")
    mongo_db = os.getenv("MONGODB_DB", "orch")
    mongo_collection = os.getenv("MONGODB_PROV_COLLECTION", "prov_events")
    mongo_configured = bool(mongo_uri)
    
    modules = [
        RegistryModule(
            id="mongodb",
            name="MongoDB",
            type="database",
            status="connected" if mongo_configured else "disconnected",
            description="Document database for provenance events and system data",
            configurable=True,
            enabled=mongo_configured,
            meta=ModuleMeta(
                database=mongo_db,
                collection=mongo_collection,
                endpoint=mongo_uri[:30] + "..." if mongo_uri and len(mongo_uri) > 30 else mongo_uri
            ),
            error_message=None if mongo_configured else "MONGODB_URI not configured"
        ),
    ]
    
    return RegistryCategory(
        id="data-stores",
        name="Data Stores",
        description="Databases and persistent storage",
        icon="database",
        configurable=True,
        modules=modules
    )


def get_provenance_category() -> RegistryCategory:
    """Get provenance system modules."""
    mongo_configured = bool(os.getenv("MONGODB_URI"))
    
    modules = [
        RegistryModule(
            id="prov-tracker",
            name="Provenance Tracker",
            type="service",
            status="running" if mongo_configured else "degraded",
            description="Immutable audit trail with hash-chain verification",
            configurable=False,
            enabled=True,
            meta=ModuleMeta(
                version="1.0.0",
                extra={"hash_algorithm": "SHA-256", "chain_type": "linked"}
            )
        ),
        RegistryModule(
            id="hitl-workflow",
            name="HITL Workflow Engine",
            type="service",
            status="running",
            description="Human-in-the-Loop approval and review workflow",
            configurable=False,
            enabled=True,
            meta=ModuleMeta(
                version="1.0.0",
                extra={"review_stages": ["primary", "secondary"]}
            )
        ),
    ]
    
    # Add Policy Engine module under Provenance & Compliance
    modules.append(
        RegistryModule(
            id="policy-engine",
            name="Policy Engine",
            type="service",
            status="running",
            description="Policy evaluation and compliance module",
            enabled=True,
            meta=ModuleMeta(
                version="1.0.0"
            )
        )
    )
    return RegistryCategory(
        id="provenance",
        name="Provenance & Compliance",
        description="Audit trail, compliance tracking, and workflow management",
        icon="shield-check",
        configurable=False,
        modules=modules
    )


async def get_mcp_category() -> MCPCategory:
    """Get MCP servers and tools."""
    servers_info = await mcp_manager.list_servers()
    
    servers: list[MCPServerWithTools] = []
    total_tools = 0
    enabled_tools = 0
    
    for server in servers_info:
        tools: list[MCPToolInfo] = []
        
        if server.status == "connected":
            try:
                detailed = await mcp_manager.get_detailed_info(server.server_id)
                tool_configs = detailed.tool_configs or {}
                
                for tool in detailed.tools:
                    tool_name = tool.get("name", "") if isinstance(tool, dict) else str(tool)
                    tool_desc = tool.get("description") if isinstance(tool, dict) else None
                    tool_schema = tool.get("inputSchema") if isinstance(tool, dict) else None
                    is_enabled = tool_configs.get(tool_name, True)
                    
                    tools.append(MCPToolInfo(
                        name=tool_name,
                        description=tool_desc,
                        enabled=is_enabled,
                        input_schema=tool_schema,
                        server_id=server.server_id,
                        server_name=server.name
                    ))
                    
                    total_tools += 1
                    if is_enabled:
                        enabled_tools += 1
                        
            except Exception as e:
                print(f"[REGISTRY] Error getting tools for {server.server_id}: {e}")
        
        servers.append(MCPServerWithTools(
            server_id=server.server_id,
            name=server.name,
            status=server.status,
            description=server.description,
            script_path=server.script_path,
            tools=tools,
            tool_count=len(tools),
            error_message=server.error_message
        ))
    
    return MCPCategory(
        servers=servers,
        total_tools=total_tools,
        enabled_tools=enabled_tools
    )


@router.get("", response_model=RegistryResponse)
async def get_registry() -> RegistryResponse:
    """Get full system registry."""
    categories = [
        get_infrastructure_category(),
        get_ai_models_category(),
        get_data_stores_category(),
        get_provenance_category(),
    ]
    
    mcp = await get_mcp_category()
    
    total_modules = sum(len(cat.modules) for cat in categories)
    total_modules += len(mcp.servers)
    
    return RegistryResponse(
        categories=categories,
        mcp=mcp,
        total_modules=total_modules,
        total_tools=mcp.total_tools
    )


@router.get("/summary")
async def get_registry_summary() -> Dict[str, Any]:
    """Get a summary of system components."""
    registry = await get_registry()
    
    return {
        "total_modules": registry.total_modules,
        "total_tools": registry.total_tools,
        "categories": [
            {
                "id": cat.id,
                "name": cat.name,
                "module_count": len(cat.modules),
                "configurable": cat.configurable
            }
            for cat in registry.categories
        ],
        "mcp_summary": {
            "server_count": len(registry.mcp.servers) if registry.mcp else 0,
            "total_tools": registry.mcp.total_tools if registry.mcp else 0,
            "enabled_tools": registry.mcp.enabled_tools if registry.mcp else 0
        }
    }
