"""
Chat service for interacting with Claude API with MCP tool-use support.
"""
from __future__ import annotations

import os
import time
from typing import Any, Dict, List

from anthropic import AsyncAnthropic
from fastapi import Request

from config import settings
from models.chat import ChatRequest, ChatResponse
from services.mcp_manager import mcp_manager
from utils.helpers import obj_to_jsonable
from utils.orch_headers import extract_orch_headers_from_request

MAX_TOOL_ROUNDS = 5  # safety cap to avoid infinite loops


def build_orch_headers(request: Request) -> Dict[str, str]:
    """Build orchestration headers to pass to external services."""
    orch = extract_orch_headers_from_request(request)
    return {
        "X-Trace-Id": orch.get("trace_id") or "",
        "X-Session-Id": orch.get("session_id") or "",
    }


def _response_to_dict(response: Any) -> Dict[str, Any]:
    """Convert an Anthropic response object to a JSON-serialisable dict."""
    if hasattr(response, "model_dump"):
        return response.model_dump()
    if hasattr(response, "__dict__"):
        reply_text = ""
        for block in getattr(response, "content", []) or []:
            if hasattr(block, "text"):
                reply_text += block.text
        return {
            "id": response.id,
            "model": response.model,
            "role": response.role,
            "content": [{"type": "text", "text": reply_text}],
            "stop_reason": response.stop_reason,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            } if response.usage else None
        }
    return {"raw": str(response)}


async def execute_chat(req: ChatRequest, request: Request) -> ChatResponse:
    """Execute chat with Claude API, including MCP tool-use loop."""
    start_time = time.time()
    api_key = settings.ANTHROPIC_API_KEY

    if not api_key:
        return ChatResponse(
            trace_id=req.trace_id,
            reply="",
            errors=["No ANTHROPIC_API_KEY configured"]
        )

    client = AsyncAnthropic(api_key=api_key)
    model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")

    # -- Build initial messages ------------------------------------------------
    messages: List[Dict[str, Any]] = []
    if req.history:
        for h in req.history:
            messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": req.message})

    # -- Gather MCP tools in Claude-API format ---------------------------------
    tools_list: List[Dict[str, Any]] = []
    tool_to_server: Dict[str, str] = {}
    try:
        tools_list, tool_to_server = await mcp_manager.get_tools_for_claude()
    except Exception as e:
        print(f"[CHAT] Warning: could not load MCP tools: {e}")

    # -- Assemble the first request payload ------------------------------------
    claude_request_obj: Dict[str, Any] = {
        "model": model,
        "max_tokens": req.max_tokens,
        "messages": messages,
    }
    if req.admin_prompt:
        claude_request_obj["system"] = req.admin_prompt
    if tools_list:
        claude_request_obj["tools"] = tools_list

    # -- Tool-use loop ---------------------------------------------------------
    mcp_tool_calls: List[Dict[str, Any]] = []
    all_responses: List[Dict[str, Any]] = []
    tool_use_rounds = 0
    t0 = time.time()

    try:
        response = await client.messages.create(**claude_request_obj)
        t1 = time.time()
        all_responses.append(_response_to_dict(response))

        while response.stop_reason == "tool_use" and tool_use_rounds < MAX_TOOL_ROUNDS:
            tool_use_rounds += 1

            # Collect tool_use blocks from the assistant response
            tool_use_blocks = [
                b for b in response.content
                if getattr(b, "type", None) == "tool_use"
            ]
            if not tool_use_blocks:
                break

            # Append the full assistant turn (with tool_use blocks) to messages
            assistant_content = []
            for b in response.content:
                if getattr(b, "type", None) == "text":
                    assistant_content.append({"type": "text", "text": b.text})
                elif getattr(b, "type", None) == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": b.id,
                        "name": b.name,
                        "input": b.input,
                    })
            messages.append({"role": "assistant", "content": assistant_content})

            # Execute each tool call via MCP and build tool_result blocks
            tool_result_blocks: List[Dict[str, Any]] = []
            for b in tool_use_blocks:
                tool_name = b.name
                tool_input = b.input or {}
                server_id = tool_to_server.get(tool_name)

                call_record: Dict[str, Any] = {
                    "server_name": server_id or "(unknown)",
                    "tool": tool_name,
                    "args": tool_input,
                    "result": None,
                    "error": None,
                    "duration_ms": None,
                }

                tc_start = time.time()
                try:
                    if not server_id:
                        raise ValueError(f"No MCP server found for tool '{tool_name}'")
                    result = await mcp_manager.call_tool(server_id, tool_name, tool_input)
                    call_record["result"] = result
                    call_record["duration_ms"] = int((time.time() - tc_start) * 1000)

                    # Build content for tool_result — must be string or list of content blocks
                    if isinstance(result, str):
                        result_content = result
                    else:
                        import json
                        result_content = json.dumps(obj_to_jsonable(result), ensure_ascii=False)

                    tool_result_blocks.append({
                        "type": "tool_result",
                        "tool_use_id": b.id,
                        "content": result_content,
                    })
                except Exception as exc:
                    call_record["error"] = str(exc)
                    call_record["duration_ms"] = int((time.time() - tc_start) * 1000)
                    tool_result_blocks.append({
                        "type": "tool_result",
                        "tool_use_id": b.id,
                        "content": f"Error: {exc}",
                        "is_error": True,
                    })

                # Replace server_id with the server name for display
                if server_id:
                    try:
                        info = await mcp_manager.get_server_info(server_id)
                        call_record["server_name"] = info.name
                    except Exception:
                        pass

                mcp_tool_calls.append(call_record)

            # Send tool results back to Claude
            messages.append({"role": "user", "content": tool_result_blocks})

            loop_request = {
                "model": model,
                "max_tokens": req.max_tokens,
                "messages": messages,
            }
            if req.admin_prompt:
                loop_request["system"] = req.admin_prompt
            if tools_list:
                loop_request["tools"] = tools_list

            response = await client.messages.create(**loop_request)
            all_responses.append(_response_to_dict(response))

        # -- Extract final text reply ------------------------------------------
        reply_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                reply_text += block.text

        resp_dict = _response_to_dict(response)
        total_time = time.time() - start_time

        return ChatResponse(
            trace_id=req.trace_id,
            reply=reply_text,
            claude_model=model,
            claude_request=claude_request_obj,
            claude_response=resp_dict,
            timings_ms={
                "total": int(total_time * 1000),
                "claude_api": int((t1 - t0) * 1000),
            },
            errors=None,
            mcp_tool_calls=mcp_tool_calls if mcp_tool_calls else None,
            tool_use_rounds=tool_use_rounds,
        )

    except Exception as e:
        total_time = time.time() - start_time
        return ChatResponse(
            trace_id=req.trace_id,
            reply="",
            claude_model=model,
            claude_request=claude_request_obj,
            timings_ms={
                "total": int(total_time * 1000)
            },
            errors=[str(e)],
            mcp_tool_calls=mcp_tool_calls if mcp_tool_calls else None,
            tool_use_rounds=tool_use_rounds,
        )
