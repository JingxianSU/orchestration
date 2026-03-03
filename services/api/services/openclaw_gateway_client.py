"""
OpenClaw Gateway WS client for real-time internal comms monitoring.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any, Dict, Optional

import websockets

from services.comm_logger import comm_logger


class OpenClawGatewayClient:
    def __init__(
        self,
        *,
        url: str,
        token: str,
        scopes: Optional[list[str]] = None,
        client_id: str = "orchestration-ui",
        client_version: str = "1.0.0",
        platform: str = "server",
        locale: str = "en-US",
        user_agent: str = "orchestration-ui/1.0.0",
        reconnect_delay: float = 3.0,
    ) -> None:
        self.url = url
        self.token = token
        self.scopes = scopes or ["operator.read"]
        self.client_id = client_id
        self.client_version = client_version
        self.platform = platform
        self.locale = locale
        self.user_agent = user_agent
        self.reconnect_delay = reconnect_delay

        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="openclaw-gateway-client")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except Exception:
                pass

    async def _run(self) -> None:
        while not self._stop.is_set():
            try:
                async with websockets.connect(self.url, ping_interval=20, ping_timeout=20) as ws:
                    await comm_logger.log(
                        source="openclaw",
                        channel="ws",
                        kind="connect",
                        payload={"url": self.url},
                    )
                    await self._handshake(ws)
                    await self._listen(ws)
            except asyncio.CancelledError:
                return
            except Exception as e:
                await comm_logger.log(
                    source="openclaw",
                    channel="ws",
                    kind="disconnect",
                    error=str(e),
                )
                await asyncio.sleep(self.reconnect_delay)

    async def _handshake(self, ws: websockets.WebSocketClientProtocol) -> None:
        """Wait for challenge and send connect request."""
        while True:
            raw = await ws.recv()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if msg.get("type") == "event" and msg.get("event") == "connect.challenge":
                break

        req_id = str(uuid.uuid4())
        connect_req = {
            "type": "req",
            "id": req_id,
            "method": "connect",
            "params": {
                "minProtocol": 3,
                "maxProtocol": 3,
                "client": {
                    "id": self.client_id,
                    "version": self.client_version,
                    "platform": self.platform,
                    "mode": "operator",
                },
                "role": "operator",
                "scopes": self.scopes,
                "caps": [],
                "commands": [],
                "permissions": {},
                "auth": {"token": self.token},
                "locale": self.locale,
                "userAgent": self.user_agent,
            },
        }

        await ws.send(json.dumps(connect_req))

        while True:
            raw = await ws.recv()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if msg.get("type") == "res" and msg.get("id") == req_id:
                if msg.get("ok"):
                    await comm_logger.log(
                        source="openclaw",
                        channel="ws",
                        kind="connect",
                        payload={"status": "hello-ok", "protocol": msg.get("payload", {}).get("protocol")},
                    )
                    return
                raise RuntimeError(str(msg.get("error") or "connect failed"))

    async def _listen(self, ws: websockets.WebSocketClientProtocol) -> None:
        while True:
            raw = await ws.recv()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("type")
            if mtype == "event":
                await comm_logger.log(
                    source="openclaw",
                    channel="event",
                    kind="event",
                    event=msg.get("event"),
                    payload=msg.get("payload") or {},
                )
                continue

            if mtype == "req":
                await comm_logger.log(
                    source="openclaw",
                    channel="req",
                    kind="request",
                    method=msg.get("method"),
                    payload=msg.get("params") or {},
                )
                continue

            if mtype == "res":
                await comm_logger.log(
                    source="openclaw",
                    channel="res",
                    kind="response",
                    ok=bool(msg.get("ok")),
                    payload=msg.get("payload") or msg.get("error") or {},
                )
                continue
