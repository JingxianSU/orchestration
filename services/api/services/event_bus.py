"""
Server-Sent Events (SSE) event bus for real-time updates.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List


class EventBus:
    """Pub/sub event bus for SSE streaming."""
    
    def __init__(self) -> None:
        self._queues: List[asyncio.Queue[str]] = []
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[str]:
        """Subscribe to events, returns a queue to receive from."""
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._queues.append(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        """Unsubscribe from events."""
        async with self._lock:
            if q in self._queues:
                self._queues.remove(q)

    async def publish(self, event: Dict[str, Any]) -> None:
        """Publish an event to all subscribers."""
        payload = json.dumps(event, ensure_ascii=False)
        async with self._lock:
            targets = list(self._queues)
        for q in targets:
            try:
                q.put_nowait(payload)
            except Exception:
                pass


# Singleton instance
event_bus = EventBus()
