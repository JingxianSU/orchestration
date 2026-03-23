"""
Message queue for managing client messages and responses.

Primary storage: in-memory dicts (fast, synchronous access).
Optional persistence: MongoDB write-through via modules.messages.db.

Call `await message_queue.init_persistence()` from the app lifespan to enable
MongoDB backing. If MongoDB is unavailable the queue works fine in-memory only.
Pending messages are recovered from MongoDB on startup when persistence is enabled.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

from models.client import ClientMessage, ClientResponse
from models.chat import ChatResponse


class MessageQueue:
    """In-memory message queue for HITL workflow with optional MongoDB persistence."""

    def __init__(self) -> None:
        self._messages: Dict[str, ClientMessage] = {}
        self._responses: Dict[str, ClientResponse] = {}
        self._chat_responses: Dict[str, ChatResponse] = {}
        self._policy_evaluations: Dict[str, Dict] = {}  # message_id -> {input: ..., output: ...}
        self._lock = asyncio.Lock()
        self._persist = False  # set True after init_persistence() succeeds

    # ---- Persistence init (optional) ----

    async def init_persistence(self) -> None:
        """Enable MongoDB write-through and recover pending messages."""
        try:
            from modules.messages import db as msg_db
            await msg_db.ensure_indexes()
            await self._recover_pending(msg_db)
            self._persist = True
            print("[MESSAGE-QUEUE] MongoDB persistence enabled")
        except Exception as e:
            print(f"[MESSAGE-QUEUE] MongoDB persistence unavailable: {e}")

    async def _recover_pending(self, msg_db) -> None:
        """Restore non-completed messages from MongoDB into in-memory cache."""
        try:
            pending = await msg_db.list_pending_messages()
            async with self._lock:
                for doc in pending:
                    msg_doc = doc.get("msg", {})
                    msg_id = doc.get("message_id", "")
                    if not msg_id or not msg_doc:
                        continue
                    try:
                        self._messages[msg_id] = ClientMessage(**{
                            k: v for k, v in msg_doc.items()
                            if k in ClientMessage.model_fields
                        })
                        self._responses[msg_id] = ClientResponse(**{
                            k: v for k, v in doc.items()
                            if k in ClientResponse.model_fields
                        })
                    except Exception:
                        pass
            print(f"[MESSAGE-QUEUE] Recovered {len(pending)} pending messages from MongoDB")
        except Exception as e:
            print(f"[MESSAGE-QUEUE] Recovery error: {e}")

    # ---- Internal persistence helper ----

    async def _persist_message(self, message_id: str) -> None:
        if not self._persist:
            return
        try:
            from modules.messages import db as msg_db
            msg = self._messages.get(message_id)
            resp = self._responses.get(message_id)
            if msg:
                await msg_db.save_message(message_id, msg.model_dump())
            if resp:
                await msg_db.save_response(message_id, resp.model_dump())
        except Exception as e:
            print(f"[MESSAGE-QUEUE] Persist error for {message_id}: {e}")

    # ---- Core queue operations ----

    async def add_message(self, msg: ClientMessage) -> None:
        """Add a new message to the queue."""
        async with self._lock:
            self._messages[msg.message_id] = msg
            self._responses[msg.message_id] = ClientResponse(
                message_id=msg.message_id,
                trace_id=msg.trace_id,
                status="pending"
            )
        await self._persist_message(msg.message_id)

    async def get_message(self, message_id: str) -> Optional[ClientMessage]:
        """Get original message by ID."""
        async with self._lock:
            return self._messages.get(message_id)

    async def get_response(self, message_id: str) -> Optional[ClientResponse]:
        """Get response status by message ID."""
        async with self._lock:
            return self._responses.get(message_id)

    async def update_response(self, message_id: str, response: ClientResponse) -> None:
        """Update response for a message."""
        async with self._lock:
            self._responses[message_id] = response
        await self._persist_message(message_id)

    async def store_chat_response(self, message_id: str, chat_resp: ChatResponse) -> None:
        """Cache complete ChatResponse."""
        async with self._lock:
            self._chat_responses[message_id] = chat_resp
        if self._persist:
            try:
                from modules.messages import db as msg_db
                await msg_db.save_chat_response(message_id, chat_resp.model_dump())
            except Exception as e:
                print(f"[MESSAGE-QUEUE] Chat response persist error: {e}")

    async def get_chat_response(self, message_id: str) -> Optional[ChatResponse]:
        """Get cached ChatResponse."""
        async with self._lock:
            return self._chat_responses.get(message_id)

    async def store_policy_evaluation(
        self, message_id: str, policy_type: str, evaluation: Dict
    ) -> None:
        """Store policy evaluation result for a message."""
        async with self._lock:
            if message_id not in self._policy_evaluations:
                self._policy_evaluations[message_id] = {}
            self._policy_evaluations[message_id][policy_type] = evaluation
        if self._persist:
            try:
                from modules.messages import db as msg_db
                await msg_db.save_policy_eval(message_id, policy_type, evaluation)
            except Exception as e:
                print(f"[MESSAGE-QUEUE] Policy eval persist error: {e}")

    async def get_policy_evaluation(
        self, message_id: str, policy_type: Optional[str] = None
    ) -> Optional[Dict]:
        """Get policy evaluation results for a message."""
        async with self._lock:
            evals = self._policy_evaluations.get(message_id)
            if not evals:
                return None
            if policy_type:
                return evals.get(policy_type)
            return evals

    async def remove_message(self, message_id: str) -> None:
        """Remove message and all related data from in-memory cache.
        Note: MongoDB records are retained for audit purposes."""
        async with self._lock:
            self._messages.pop(message_id, None)
            self._responses.pop(message_id, None)
            self._chat_responses.pop(message_id, None)
            self._policy_evaluations.pop(message_id, None)


# Singleton instance
message_queue = MessageQueue()
