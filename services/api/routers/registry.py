"""
Registry router - system component registry API.

Components are stored in MongoDB (registry DB) and seeded with defaults on startup.
The GET /api/registry endpoint assembles categories from MongoDB + live MCP data.
Full CRUD is available at /api/registry/components.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from anthropic import AsyncAnthropic

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


# ---- Category metadata (static structure, modules come from DB) ----

CATEGORY_META = {
    "infrastructure": {
        "id": "infrastructure", "name": "Infrastructure",
        "description": "Core system components and services", "icon": "server", "configurable": False,
    },
    "ai-models": {
        "id": "ai-models", "name": "AI Models",
        "description": "Language models and AI services", "icon": "brain", "configurable": True,
    },
    "data-stores": {
        "id": "data-stores", "name": "Data Stores",
        "description": "Databases and persistent storage", "icon": "database", "configurable": True,
    },
    "provenance": {
        "id": "provenance", "name": "Provenance & Compliance",
        "description": "Audit trail, compliance tracking, and workflow management",
        "icon": "shield-check", "configurable": False,
    },
}

CATEGORY_ORDER = ["infrastructure", "ai-models", "data-stores", "provenance"]


async def _try_get_registry_db():
    """Return registry db module if MongoDB is available, else None."""
    try:
        from modules.registry import db as reg_db
        return reg_db
    except Exception:
        return None


def _component_to_module(comp: Dict[str, Any]) -> RegistryModule:
    """Convert a MongoDB component doc to a RegistryModule."""
    meta_raw = comp.get("meta", {}) or {}
    meta = ModuleMeta(
        version=meta_raw.get("version"),
        framework=meta_raw.get("framework"),
        provider=meta_raw.get("provider"),
        model=meta_raw.get("model"),
        database=meta_raw.get("database"),
        collection=meta_raw.get("collection"),
        endpoint=meta_raw.get("endpoint"),
        extra={k: v for k, v in meta_raw.items()
               if k not in {"version", "framework", "provider", "model", "database", "collection", "endpoint"}
               } or None,
    )
    return RegistryModule(
        id=comp.get("id", ""),
        name=comp.get("name", ""),
        type=comp.get("type", "service"),
        status=comp.get("status", "unknown"),
        description=comp.get("description"),
        configurable=comp.get("configurable", False),
        enabled=comp.get("enabled", True),
        meta=meta,
        error_message=comp.get("error_message"),
    )


async def _build_categories_from_db() -> List[RegistryCategory]:
    """Build category list by reading components from MongoDB, with fallback."""
    try:
        reg_db = await _try_get_registry_db()
        if not reg_db:
            return _fallback_categories()
        components = await reg_db.list_components()
    except Exception as e:
        print(f"[REGISTRY] MongoDB unavailable, using fallback: {e}")
        return _fallback_categories()
    by_category: Dict[str, List[RegistryModule]] = {cid: [] for cid in CATEGORY_ORDER}

    for comp in components:
        cat_id = comp.get("category_id", "")
        if cat_id in by_category:
            by_category[cat_id].append(_component_to_module(comp))

    categories = []
    for cat_id in CATEGORY_ORDER:
        meta = CATEGORY_META.get(cat_id, {})
        categories.append(RegistryCategory(
            id=meta.get("id", cat_id),
            name=meta.get("name", cat_id),
            description=meta.get("description"),
            icon=meta.get("icon"),
            configurable=meta.get("configurable", False),
            modules=by_category.get(cat_id, []),
        ))

    return categories


def _fallback_categories() -> List[RegistryCategory]:
    """Static fallback when MongoDB is unavailable."""
    model = settings.CLAUDE_MODEL or os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
    api_key_configured = bool(settings.ANTHROPIC_API_KEY)
    mongo_uri = os.getenv("MONGODB_URI")

    infrastructure = RegistryCategory(
        id="infrastructure", name="Infrastructure",
        description="Core system components and services", icon="server",
        modules=[
            RegistryModule(id="user-interface", name="Web Admin Dashboard", type="frontend",
                           status="running", description="React-based administration interface",
                           meta=ModuleMeta(version="1.0.0", framework="React + TypeScript + Vite")),
            RegistryModule(id="api-gateway", name="Orchestration API", type="backend",
                           status="running", description="FastAPI service for HITL workflow",
                           meta=ModuleMeta(version="1.0.0", framework="FastAPI + Python")),
        ],
    )
    ai_models = RegistryCategory(
        id="ai-models", name="AI Models", description="Language models and AI services",
        icon="brain", configurable=True,
        modules=[
            RegistryModule(id="claude-api", name="Claude API", type="llm",
                           status="configured" if api_key_configured else "disconnected",
                           description="Anthropic Claude language model",
                           configurable=True, enabled=api_key_configured,
                           meta=ModuleMeta(provider="Anthropic", model=model, version="API v1")),
        ],
    )
    data_stores = RegistryCategory(
        id="data-stores", name="Data Stores", description="Databases and persistent storage",
        icon="database", configurable=True,
        modules=[
            RegistryModule(id="mongodb", name="MongoDB", type="database",
                           status="connected" if mongo_uri else "disconnected",
                           description="Document database for provenance events",
                           configurable=True, enabled=bool(mongo_uri)),
        ],
    )
    provenance = RegistryCategory(
        id="provenance", name="Provenance & Compliance",
        description="Audit trail, compliance tracking, and workflow management",
        icon="shield-check",
        modules=[
            RegistryModule(id="prov-tracker", name="Provenance Tracker", type="service",
                           status="running" if mongo_uri else "degraded",
                           description="Immutable audit trail with hash-chain verification",
                           meta=ModuleMeta(version="1.0.0")),
            RegistryModule(id="hitl-workflow", name="HITL Workflow Engine", type="service",
                           status="running", description="Human-in-the-Loop approval workflow",
                           meta=ModuleMeta(version="1.0.0")),
            RegistryModule(id="policy-engine", name="Policy Engine", type="service",
                           status="running", description="Policy evaluation and compliance module",
                           configurable=True, meta=ModuleMeta(version="1.0.0")),
        ],
    )
    return [infrastructure, ai_models, data_stores, provenance]


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
                        name=tool_name, description=tool_desc, enabled=is_enabled,
                        input_schema=tool_schema, server_id=server.server_id, server_name=server.name,
                    ))
                    total_tools += 1
                    if is_enabled:
                        enabled_tools += 1
            except Exception as e:
                print(f"[REGISTRY] Error getting tools for {server.server_id}: {e}")
        servers.append(MCPServerWithTools(
            server_id=server.server_id, name=server.name, status=server.status,
            description=server.description, script_path=server.script_path,
            tools=tools, tool_count=len(tools), error_message=server.error_message,
        ))

    return MCPCategory(servers=servers, total_tools=total_tools, enabled_tools=enabled_tools)


# ---- Main registry endpoints ----

class ExplainRequest(BaseModel):
    name: str
    type: str
    description: Optional[str] = None
    explanation: Optional[str] = None


class ExplainResponse(BaseModel):
    explanation: str


@router.post("/explain", response_model=ExplainResponse)
async def explain_component(req: ExplainRequest) -> ExplainResponse:
    """Ask AI to explain a registry component in the context of this orchestration system."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return ExplainResponse(explanation="No AI API key configured. Please set ANTHROPIC_API_KEY.")

    type_label = {"module": "system module", "tool": "MCP tool", "server": "MCP server"}.get(req.type, "component")
    description_block = f"\nKnown description: {req.description}" if req.description else ""
    existing_block = f"\nExisting explanation: {req.explanation}" if req.explanation else ""

    prompt = f"""You are an expert on Trustworthy AI orchestration systems.

A user is viewing the component registry of an AI orchestration platform. This system implements a Human-in-the-Loop (HITL) workflow for AI safety and compliance, built around the 10 Criteria for Orchestration AI (Transparency, Explainability, Interpretability, Fairness, Accountability, Privacy, Safety, Reliability, Security, Governance).

The component being queried is:
- **Name**: {req.name}
- **Type**: {type_label}{description_block}{existing_block}

Provide a clear, concise explanation (3–5 paragraphs) covering:
1. What this {type_label} does within the orchestration system
2. Which of the 10 criteria it most directly supports, and how
3. Its role in enabling Trustworthy AI

Write in plain English for a technical user."""

    try:
        client = AsyncAnthropic(api_key=api_key)
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
        response = await client.messages.create(
            model=model, max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text if response.content else ""
        return ExplainResponse(explanation=text)
    except Exception as e:
        return ExplainResponse(explanation=f"AI explanation failed: {str(e)}")


@router.get("", response_model=RegistryResponse)
async def get_registry() -> RegistryResponse:
    """Get full system registry from MongoDB (falls back to static if unavailable)."""
    categories = await _build_categories_from_db()
    mcp = await get_mcp_category()
    total_modules = sum(len(cat.modules) for cat in categories) + len(mcp.servers)
    return RegistryResponse(
        categories=categories, mcp=mcp,
        total_modules=total_modules, total_tools=mcp.total_tools,
    )


@router.get("/summary")
async def get_registry_summary() -> Dict[str, Any]:
    """Get a summary of system components."""
    registry = await get_registry()
    return {
        "total_modules": registry.total_modules,
        "total_tools": registry.total_tools,
        "categories": [
            {"id": cat.id, "name": cat.name, "module_count": len(cat.modules), "configurable": cat.configurable}
            for cat in registry.categories
        ],
        "mcp_summary": {
            "server_count": len(registry.mcp.servers) if registry.mcp else 0,
            "total_tools": registry.mcp.total_tools if registry.mcp else 0,
            "enabled_tools": registry.mcp.enabled_tools if registry.mcp else 0,
        },
    }


# ---- Component CRUD ----

class ComponentRequest(BaseModel):
    id: Optional[str] = None
    category_id: str
    name: str
    type: str = "service"
    status: str = "running"
    description: Optional[str] = None
    configurable: bool = False
    enabled: bool = True
    meta: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


@router.get("/components", response_model=List[Dict[str, Any]])
async def list_components(category_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """List all registered components, optionally filtered by category."""
    reg_db = await _try_get_registry_db()
    if not reg_db:
        raise HTTPException(status_code=503, detail="Registry database not available")
    return await reg_db.list_components(category_id)


@router.post("/components", response_model=Dict[str, Any], status_code=201)
async def create_component(req: ComponentRequest) -> Dict[str, Any]:
    """Register a new component."""
    import uuid as _uuid
    reg_db = await _try_get_registry_db()
    if not reg_db:
        raise HTTPException(status_code=503, detail="Registry database not available")
    component = req.model_dump()
    if not component.get("id"):
        component["id"] = str(_uuid.uuid4())
    return await reg_db.upsert_component(component)


@router.put("/components/{component_id}", response_model=Dict[str, Any])
async def update_component(component_id: str, req: ComponentRequest) -> Dict[str, Any]:
    """Update a registered component."""
    reg_db = await _try_get_registry_db()
    if not reg_db:
        raise HTTPException(status_code=503, detail="Registry database not available")
    existing = await reg_db.get_component(component_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Component not found")
    updates = req.model_dump(exclude_unset=True)
    updates.pop("id", None)
    return await reg_db.update_component(component_id, updates)


@router.delete("/components/{component_id}")
async def delete_component(component_id: str) -> Dict[str, str]:
    """Remove a component from the registry."""
    reg_db = await _try_get_registry_db()
    if not reg_db:
        raise HTTPException(status_code=503, detail="Registry database not available")
    ok = await reg_db.delete_component(component_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Component not found")
    return {"status": "deleted", "id": component_id}
