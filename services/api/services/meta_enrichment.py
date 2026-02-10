"""
Meta enrichment service — builds the _meta dict injected into llm_response
for LiveTab routing / MCP / policy tabs.

Routing and MCP data are extracted from the actual Claude response and
tool-use loop executed in chat_service.py.  No extra LLM calls.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from models.chat import ChatResponse
from services.mcp_manager import mcp_manager
from utils.helpers import iso_utc_now


# ---------------------------------------------------------------------------
# Routing — derived from what Claude actually did
# ---------------------------------------------------------------------------

def _extract_routing(chat_response: ChatResponse) -> Dict[str, Any]:
    """Build routing info from the chat response.

    If Claude returned ``tool_use`` blocks (i.e. ``tool_use_rounds > 0``),
    that *is* the routing decision — Claude decided MCP tools were needed.
    """
    used_tools = bool(chat_response.mcp_tool_calls)
    tool_use_rounds = chat_response.tool_use_rounds or 0

    # Check what tools were provided in the request
    tools_in_request = (chat_response.claude_request or {}).get("tools", [])
    tools_available = bool(tools_in_request)

    if used_tools:
        tool_names = [tc["tool"] for tc in (chat_response.mcp_tool_calls or [])]
        server_names = list({
            tc["server_name"]
            for tc in (chat_response.mcp_tool_calls or [])
        })
        reason = (
            f"Claude invoked {len(tool_names)} tool call(s) "
            f"across {tool_use_rounds} round(s): {tool_names}"
        )
    elif tools_available:
        server_names = []
        reason = (
            f"Claude had access to {len(tools_in_request)} tool(s) "
            f"but chose not to use any"
        )
    else:
        server_names = []
        reason = "No MCP tools were available for this request"

    return {
        "requires_mcp": used_tools,
        "reason": reason,
        "suggested_servers": server_names,
        "tools_available": len(tools_in_request),
        "tools_used": len(chat_response.mcp_tool_calls or []),
        "tool_use_rounds": tool_use_rounds,
        "router_model": None,  # no separate router model — Claude decided itself
    }


# ---------------------------------------------------------------------------
# MCP context — from actual tool calls
# ---------------------------------------------------------------------------

async def _build_mcp_context(
    chat_response: ChatResponse,
) -> List[Dict[str, Any]]:
    """Build mcp_context from tool calls actually executed in the chat loop."""
    calls = chat_response.mcp_tool_calls
    if calls:
        return list(calls)

    # Even if no tools were called, show what servers/tools are available
    try:
        servers = await mcp_manager.get_servers_summary()
    except Exception:
        return []

    connected = [s for s in servers if s["status"] == "connected"]
    if not connected:
        return []

    entries: List[Dict[str, Any]] = []
    for s in connected:
        enabled_tools = [t["name"] for t in s["tools"] if t.get("enabled")]
        entries.append({
            "server_name": s["name"],
            "tool": "(none called)",
            "args": {},
            "result": {
                "server_id": s["server_id"],
                "status": s["status"],
                "available_tools": enabled_tools,
            },
            "error": None,
            "duration_ms": None,
        })
    return entries


# ---------------------------------------------------------------------------
# Policy summary
# ---------------------------------------------------------------------------

def _build_policy_summary(
    input_eval: Optional[Any] = None,
    output_eval: Optional[Any] = None,
) -> Optional[Dict[str, Any]]:
    """Summarize policy evaluation results (if any)."""
    if input_eval is None and output_eval is None:
        return None

    summary: Dict[str, Any] = {}

    if input_eval is not None:
        summary["input"] = {
            "decision": getattr(input_eval, "decision", None),
            "passed": getattr(input_eval, "passed", None),
            "violations_count": len(getattr(input_eval, "violations", []) or []),
            "summary": getattr(input_eval, "summary", None),
            "evaluation_time_ms": getattr(input_eval, "evaluation_time_ms", None),
        }

    if output_eval is not None:
        summary["output"] = {
            "decision": getattr(output_eval, "decision", None),
            "passed": getattr(output_eval, "passed", None),
            "violations_count": len(getattr(output_eval, "violations", []) or []),
            "summary": getattr(output_eval, "summary", None),
            "evaluation_time_ms": getattr(output_eval, "evaluation_time_ms", None),
        }

    return summary


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def build_meta(
    user_message: str,
    chat_response: ChatResponse,
    input_eval: Optional[Any] = None,
    output_eval: Optional[Any] = None,
) -> Dict[str, Any]:
    """Build an enriched ``llm_response`` dict with ``_meta`` injected.

    All routing / MCP data is extracted from the *actual* Claude response
    and tool-use loop — no extra LLM calls.

    Returns a *copy* of ``chat_response.claude_response`` with ``_meta``
    added.  If anything goes wrong the raw dict is returned unchanged.
    """
    raw = chat_response.claude_response or {}

    try:
        routing = _extract_routing(chat_response)
        mcp_context = await _build_mcp_context(chat_response)
        policy_summary = _build_policy_summary(input_eval, output_eval)

        meta: Dict[str, Any] = {
            "routing": routing,
            "mcp_context": mcp_context,
            "enriched_at": iso_utc_now(),
        }
        if policy_summary is not None:
            meta["policy"] = policy_summary

        enriched = dict(raw)
        enriched["_meta"] = meta
        return enriched

    except Exception as exc:
        print(f"[META-ENRICHMENT] Error building _meta, returning raw response: {exc}")
        return dict(raw)
