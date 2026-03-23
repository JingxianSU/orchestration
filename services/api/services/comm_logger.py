"""
Communication logger for OpenClaw gateway traffic.
"""
from __future__ import annotations

import time
import uuid
import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from collections import deque

from services.event_bus import event_bus


@dataclass
class CommLogEntry:
    id: str
    timestamp: float
    source: str  # e.g. "openclaw"
    channel: str  # "ws" | "event" | "req" | "res"
    kind: str  # "connect" | "disconnect" | "event" | "request" | "response"
    event: Optional[str] = None
    method: Optional[str] = None
    ok: Optional[bool] = None
    payload: Optional[Dict[str, Any]] = field(default_factory=dict)
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "datetime": datetime.fromtimestamp(self.timestamp).isoformat(),
            "source": self.source,
            "channel": self.channel,
            "kind": self.kind,
            "event": self.event,
            "method": self.method,
            "ok": self.ok,
            "payload": self.payload,
            "error": self.error,
        }


class CommLogger:
    def __init__(self, max_entries: int = 2000) -> None:
        self._logs: deque[CommLogEntry] = deque(maxlen=max_entries)
        self._lock = asyncio.Lock()

    async def log(
        self,
        *,
        source: str,
        channel: str,
        kind: str,
        event: Optional[str] = None,
        method: Optional[str] = None,
        ok: Optional[bool] = None,
        payload: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> CommLogEntry:
        entry = CommLogEntry(
            id=str(uuid.uuid4()),
            timestamp=time.time(),
            source=source,
            channel=channel,
            kind=kind,
            event=event,
            method=method,
            ok=ok,
            payload=payload or {},
            error=error,
        )

        async with self._lock:
            self._logs.appendleft(entry)

        await event_bus.publish({
            "type": "comm_log",
            "data": entry.to_dict(),
            "ts": entry.timestamp,
        })

        return entry

    async def get_logs(
        self,
        limit: int = 200,
        channel: Optional[str] = None,
        kind: Optional[str] = None,
        event: Optional[str] = None,
        method: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        async with self._lock:
            logs = list(self._logs)

        if channel:
            logs = [l for l in logs if l.channel == channel]
        if kind:
            logs = [l for l in logs if l.kind == kind]
        if event:
            logs = [l for l in logs if l.event == event]
        if method:
            logs = [l for l in logs if l.method == method]

        return [l.to_dict() for l in logs[:limit]]

    async def clear_logs(self) -> int:
        async with self._lock:
            count = len(self._logs)
            self._logs.clear()
        return count


comm_logger = CommLogger()
