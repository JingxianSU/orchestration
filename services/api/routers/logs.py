"""
HTTP Logs API Router.

Provides endpoints for querying and managing HTTP logs.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from services.http_logger import http_logger

router = APIRouter(prefix="/api/logs", tags=["Logs"])


@router.get("")
async def get_logs(
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum logs to return"),
    direction: Optional[str] = Query(default=None, description="Filter by direction: inbound/outbound"),
    method: Optional[str] = Query(default=None, description="Filter by HTTP method"),
    status_min: Optional[int] = Query(default=None, description="Minimum status code"),
    status_max: Optional[int] = Query(default=None, description="Maximum status code"),
):
    """
    Get recent HTTP logs with optional filtering.

    Returns a list of HTTP request/response log entries.
    """
    logs = await http_logger.get_logs(
        limit=limit,
        direction=direction,
        method=method,
        status_min=status_min,
        status_max=status_max,
    )
    return {
        "logs": logs,
        "count": len(logs),
    }


@router.delete("")
async def clear_logs():
    """Clear all HTTP logs."""
    count = await http_logger.clear_logs()
    return {
        "cleared": count,
        "message": f"Cleared {count} log entries",
    }


@router.get("/stats")
async def get_log_stats():
    """Get HTTP log statistics."""
    all_logs = await http_logger.get_logs(limit=1000)

    # Calculate stats
    total = len(all_logs)
    inbound = sum(1 for l in all_logs if l["direction"] == "inbound")
    outbound = sum(1 for l in all_logs if l["direction"] == "outbound")

    # Status code distribution
    status_counts = {}
    for log in all_logs:
        code = log.get("status_code")
        if code:
            bucket = f"{code // 100}xx"
            status_counts[bucket] = status_counts.get(bucket, 0) + 1

    # Method distribution
    method_counts = {}
    for log in all_logs:
        method = log.get("method", "UNKNOWN")
        method_counts[method] = method_counts.get(method, 0) + 1

    # Average duration
    durations = [l.get("duration_ms") for l in all_logs if l.get("duration_ms")]
    avg_duration = sum(durations) / len(durations) if durations else 0

    # Error count
    errors = sum(1 for l in all_logs if l.get("error"))

    return {
        "total": total,
        "inbound": inbound,
        "outbound": outbound,
        "errors": errors,
        "avg_duration_ms": round(avg_duration, 2),
        "status_distribution": status_counts,
        "method_distribution": method_counts,
    }
