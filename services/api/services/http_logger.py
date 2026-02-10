"""
HTTP Request/Response Logger Service.

Captures all incoming HTTP requests and outgoing responses,
publishing them to the event bus for real-time monitoring.
"""
from __future__ import annotations

import time
import uuid
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional
from collections import deque
from dataclasses import dataclass, field, asdict

from services.event_bus import event_bus


@dataclass
class HttpLogEntry:
    """Represents a single HTTP log entry."""
    id: str
    timestamp: float
    direction: str  # "inbound" or "outbound"
    method: str
    url: str
    status_code: Optional[int] = None
    request_headers: Dict[str, str] = field(default_factory=dict)
    response_headers: Dict[str, str] = field(default_factory=dict)
    request_body: Optional[str] = None
    response_body: Optional[str] = None
    duration_ms: Optional[float] = None
    error: Optional[str] = None
    trace_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "datetime": datetime.fromtimestamp(self.timestamp).isoformat(),
            "direction": self.direction,
            "method": self.method,
            "url": self.url,
            "status_code": self.status_code,
            "request_headers": self.request_headers,
            "response_headers": self.response_headers,
            "request_body": self.request_body,
            "response_body": self.response_body,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "trace_id": self.trace_id,
        }


class HttpLogger:
    """
    HTTP Logger that captures and broadcasts HTTP traffic.

    Maintains an in-memory buffer of recent logs and publishes
    new entries to the SSE event bus.
    """

    def __init__(self, max_entries: int = 1000) -> None:
        self._logs: deque[HttpLogEntry] = deque(maxlen=max_entries)
        self._lock = asyncio.Lock()

    async def log_request(
        self,
        direction: str,
        method: str,
        url: str,
        status_code: Optional[int] = None,
        request_headers: Optional[Dict[str, str]] = None,
        response_headers: Optional[Dict[str, str]] = None,
        request_body: Optional[str] = None,
        response_body: Optional[str] = None,
        duration_ms: Optional[float] = None,
        error: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> HttpLogEntry:
        """
        Log an HTTP request/response and publish to event bus.

        Args:
            direction: "inbound" for incoming requests, "outbound" for outgoing
            method: HTTP method (GET, POST, etc.)
            url: Request URL
            status_code: HTTP response status code
            request_headers: Request headers dict
            response_headers: Response headers dict
            request_body: Request body (truncated if large)
            response_body: Response body (truncated if large)
            duration_ms: Request duration in milliseconds
            error: Error message if request failed
            trace_id: Optional trace ID for correlation

        Returns:
            The created HttpLogEntry
        """
        entry = HttpLogEntry(
            id=str(uuid.uuid4()),
            timestamp=time.time(),
            direction=direction,
            method=method,
            url=url,
            status_code=status_code,
            request_headers=request_headers or {},
            response_headers=response_headers or {},
            request_body=self._truncate(request_body),
            response_body=self._truncate(response_body),
            duration_ms=duration_ms,
            error=error,
            trace_id=trace_id,
        )

        async with self._lock:
            self._logs.appendleft(entry)

        # Publish to event bus for SSE streaming
        await event_bus.publish({
            "type": "http_log",
            "data": entry.to_dict(),
            "ts": entry.timestamp,
        })

        # Also print to console for debugging
        status_str = f" -> {status_code}" if status_code else ""
        duration_str = f" ({duration_ms:.0f}ms)" if duration_ms else ""
        error_str = f" ERROR: {error}" if error else ""
        print(f"[HTTP-LOG] [{direction.upper()}] {method} {url}{status_str}{duration_str}{error_str}")

        return entry

    async def get_logs(
        self,
        limit: int = 100,
        direction: Optional[str] = None,
        method: Optional[str] = None,
        status_min: Optional[int] = None,
        status_max: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get recent logs with optional filtering.

        Args:
            limit: Maximum number of logs to return
            direction: Filter by direction ("inbound" or "outbound")
            method: Filter by HTTP method
            status_min: Minimum status code
            status_max: Maximum status code

        Returns:
            List of log entries as dictionaries
        """
        async with self._lock:
            logs = list(self._logs)

        # Apply filters
        if direction:
            logs = [l for l in logs if l.direction == direction]
        if method:
            logs = [l for l in logs if l.method.upper() == method.upper()]
        if status_min is not None:
            logs = [l for l in logs if l.status_code and l.status_code >= status_min]
        if status_max is not None:
            logs = [l for l in logs if l.status_code and l.status_code <= status_max]

        return [l.to_dict() for l in logs[:limit]]

    async def clear_logs(self) -> int:
        """Clear all logs. Returns the number of logs cleared."""
        async with self._lock:
            count = len(self._logs)
            self._logs.clear()
        return count

    def _truncate(self, text: Optional[str], max_length: int = 10000) -> Optional[str]:
        """Truncate text to max length."""
        if text is None:
            return None
        if len(text) <= max_length:
            return text
        return text[:max_length] + f"... [truncated, total {len(text)} chars]"


# Singleton instance
http_logger = HttpLogger()
