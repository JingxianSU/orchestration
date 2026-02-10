"""
Server-Sent Events (SSE) streaming endpoint.
"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from services.event_bus import event_bus

router = APIRouter(prefix="/api", tags=["Stream"])


@router.get("/stream")
async def stream(request: Request):
    """SSE stream for real-time updates."""
    q = await event_bus.subscribe()
    
    async def gen():
        try:
            yield "event: hello\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)
                    try:
                        data = json.loads(msg)
                        event_type = data.get("type", "trace")
                        
                        if event_type == "hitl_request":
                            yield f"event: hitl\ndata: {msg}\n\n"
                        else:
                            yield f"event: trace\ndata: {msg}\n\n"
                        
                        yield f"data: {msg}\n\n"
                    except:
                        yield f"event: trace\ndata: {msg}\n\n"
                        yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
        finally:
            await event_bus.unsubscribe(q)
    
    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        },
    )
