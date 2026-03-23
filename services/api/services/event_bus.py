"""
Server-Sent Events (SSE) event bus for real-time updates and inter-module communication.

Supports two subscriber types:
  1. SSE queues   — frontend clients via GET /api/stream
  2. Internal handlers — async callbacks for module-to-module events

Published events reach both SSE subscribers and registered internal handlers.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Callable, Coroutine, Dict, List


class EventBus:
    """Pub/sub event bus for SSE streaming and internal module communication."""

    def __init__(self) -> None:
        self._queues: List[asyncio.Queue[str]] = []
        self._handlers: Dict[str, List[Callable]] = {}  # event_type -> handlers
        self._lock = asyncio.Lock()

    # ---- SSE subscribers ----

    async def subscribe(self) -> asyncio.Queue[str]:
        """Subscribe to events via SSE; returns a queue to receive from."""
        q: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._queues.append(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue[str]) -> None:
        """Unsubscribe an SSE queue."""
        async with self._lock:
            if q in self._queues:
                self._queues.remove(q)

    # ---- Internal module handlers ----

    async def subscribe_handler(
        self,
        event_type: str,
        handler: Callable[[Dict[str, Any]], Coroutine],
    ) -> None:
        """Register an async handler for a specific event type.

        Use "*" as event_type to receive all events.
        Handler signature: async def handler(event: dict) -> None
        """
        async with self._lock:
            self._handlers.setdefault(event_type, []).append(handler)

    async def unsubscribe_handler(self, event_type: str, handler: Callable) -> None:
        async with self._lock:
            handlers = self._handlers.get(event_type, [])
            if handler in handlers:
                handlers.remove(handler)

    # ---- Publishing ----

    async def publish(self, event: Dict[str, Any]) -> None:
        """Publish an event to all SSE queues and matching internal handlers."""
        payload = json.dumps(event, ensure_ascii=False)
        event_type = event.get("type", "")

        async with self._lock:
            sse_targets = list(self._queues)
            type_handlers = list(self._handlers.get(event_type, []))
            wildcard_handlers = list(self._handlers.get("*", []))

        # Push to SSE streams
        for q in sse_targets:
            try:
                q.put_nowait(payload)
            except Exception:
                pass

        # Fire internal handlers as background tasks (non-blocking)
        for handler in type_handlers + wildcard_handlers:
            try:
                asyncio.create_task(handler(event))
            except Exception as e:
                print(f"[EVENT-BUS] Handler error for '{event_type}': {e}")


# Singleton instance
event_bus = EventBus()
