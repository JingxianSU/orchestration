"""
OpenClaw local data reader: workspace files, session transcripts, and mDNS discovery.
Runs independently of the WS gateway connection.
"""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Optional

from services.comm_logger import comm_logger

OPENCLAW_HOME = Path.home() / ".openclaw"


class OpenClawLocalReader:
    """Polls local OpenClaw directories and streams their contents as comm_log entries."""

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        # Track how many lines we've already emitted per JSONL file
        self._seen_lines: dict[str, int] = {}

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name="openclaw-local-reader")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except Exception:
                pass

    async def _run(self) -> None:
        # Initial load of static resources
        await self._load_workspace()
        await self._load_transcripts()
        await self._discover_mdns()

        # Poll for new transcript lines every 5 s
        while not self._stop.is_set():
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=5)
            except asyncio.TimeoutError:
                pass
            if not self._stop.is_set():
                await self._load_transcripts()

    # ── Workspace ──────────────────────────────────────────────────────────────

    async def _load_workspace(self) -> None:
        workspace_dir = OPENCLAW_HOME / "workspace"
        if not workspace_dir.exists():
            print(f"[LOCAL-READER] Workspace dir not found: {workspace_dir}")
            return
        for md_file in sorted(workspace_dir.glob("*.md")):
            try:
                content = md_file.read_text(encoding="utf-8", errors="replace")
                await comm_logger.log(
                    source="openclaw:workspace",
                    channel="workspace",
                    kind="file",
                    event=md_file.name,
                    payload={
                        "name": md_file.name,
                        "content": content,
                        "size": len(content),
                        "path": str(md_file),
                    },
                )
                print(f"[LOCAL-READER] Loaded workspace file: {md_file.name}")
            except Exception as e:
                await comm_logger.log(
                    source="openclaw:workspace",
                    channel="workspace",
                    kind="file",
                    event=md_file.name,
                    error=str(e),
                )

    # ── Transcripts ────────────────────────────────────────────────────────────

    async def _load_transcripts(self) -> None:
        agents_dir = OPENCLAW_HOME / "agents"
        if not agents_dir.exists():
            return
        for agent_dir in sorted(agents_dir.iterdir()):
            if not agent_dir.is_dir():
                continue
            sessions_dir = agent_dir / "sessions"
            if not sessions_dir.exists():
                continue
            for jsonl_file in sorted(sessions_dir.glob("*.jsonl")):
                await self._tail_jsonl(jsonl_file, agent_dir.name, jsonl_file.stem)

    async def _tail_jsonl(self, path: Path, agent_id: str, session_id: str) -> None:
        path_str = str(path)
        already_read = self._seen_lines.get(path_str, 0)
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
            new_lines = lines[already_read:]
            for line in new_lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except Exception:
                    entry = {"raw": line}
                await comm_logger.log(
                    source=f"openclaw:transcript:{agent_id}",
                    channel="transcript",
                    kind="entry",
                    event=session_id,
                    payload={
                        **entry,
                        "_agent_id": agent_id,
                        "_session_id": session_id,
                    },
                )
            if new_lines:
                print(f"[LOCAL-READER] Emitted {len(new_lines)} new lines from {path.name}")
            self._seen_lines[path_str] = len(lines)
        except Exception:
            pass

    # ── mDNS Discovery ─────────────────────────────────────────────────────────

    async def _discover_mdns(self) -> None:
        try:
            import socket
            from zeroconf import ServiceBrowser, Zeroconf  # type: ignore

            discovered: list[dict] = []

            class _Listener:
                def add_service(self, zc, type_, name):  # type: ignore
                    info = zc.get_service_info(type_, name)
                    if info:
                        addresses = [socket.inet_ntoa(a) for a in info.addresses]
                        txt = {
                            k.decode() if isinstance(k, bytes) else k: (
                                v.decode() if isinstance(v, bytes) else v
                            )
                            for k, v in (info.properties or {}).items()
                        }
                        discovered.append({
                            "name": name,
                            "host": addresses[0] if addresses else None,
                            "port": info.port,
                            "txt": txt,
                        })

                def remove_service(self, zc, type_, name):  # type: ignore
                    pass

                def update_service(self, zc, type_, name):  # type: ignore
                    pass

            zc = Zeroconf()
            ServiceBrowser(zc, "_openclaw-gw._tcp.local.", _Listener())
            await asyncio.sleep(2)
            zc.close()

            for svc in discovered:
                await comm_logger.log(
                    source="openclaw:discovery",
                    channel="discovery",
                    kind="service",
                    event="mdns",
                    payload=svc,
                )
                print(f"[LOCAL-READER] Discovered service: {svc.get('name')}")

            if not discovered:
                print("[LOCAL-READER] No _openclaw-gw._tcp services found via mDNS")

        except ImportError:
            print("[LOCAL-READER] zeroconf not installed – skipping mDNS discovery")
        except Exception as e:
            print(f"[LOCAL-READER] mDNS discovery error: {e}")


openclaw_local_reader = OpenClawLocalReader()
