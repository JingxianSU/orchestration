"""
Communication logs API router.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from services.comm_logger import comm_logger

router = APIRouter(prefix="/api/comm-logs", tags=["CommLogs"])


@router.get("")
async def get_comm_logs(
    limit: int = Query(default=200, ge=1, le=2000, description="Maximum logs to return"),
    channel: Optional[str] = Query(default=None, description="Filter by channel: ws/event/req/res"),
    kind: Optional[str] = Query(default=None, description="Filter by kind: connect/disconnect/event/request/response"),
    event: Optional[str] = Query(default=None, description="Filter by event name"),
    method: Optional[str] = Query(default=None, description="Filter by method name"),
):
    logs = await comm_logger.get_logs(
        limit=limit,
        channel=channel,
        kind=kind,
        event=event,
        method=method,
    )
    return {"logs": logs, "count": len(logs)}


@router.delete("")
async def clear_comm_logs():
    count = await comm_logger.clear_logs()
    return {"cleared": count, "message": f"Cleared {count} comm log entries"}
