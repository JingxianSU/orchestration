"""
Message queue for managing client messages and responses.
"""
from __future__ import annotations

import asyncio
from typing import Dict, Optional

from models.client import ClientMessage, ClientResponse
from models.chat import ChatResponse


class MessageQueue:
    """In-memory message queue for HITL workflow."""
    
    def __init__(self) -> None:
        self._messages: Dict[str, ClientMessage] = {}
        self._responses: Dict[str, ClientResponse] = {}
        self._chat_responses: Dict[str, ChatResponse] = {}
        self._lock = asyncio.Lock()

    async def add_message(self, msg: ClientMessage) -> None:
        """Add a new message to the queue."""
        async with self._lock:
            self._messages[msg.message_id] = msg
            self._responses[msg.message_id] = ClientResponse(
                message_id=msg.message_id,
                trace_id=msg.trace_id,
                status="pending"
            )

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

    async def store_chat_response(self, message_id: str, chat_resp: ChatResponse) -> None:
        """Cache complete ChatResponse."""
        async with self._lock:
            self._chat_responses[message_id] = chat_resp

    async def get_chat_response(self, message_id: str) -> Optional[ChatResponse]:
        """Get cached ChatResponse."""
        async with self._lock:
            return self._chat_responses.get(message_id)

    async def remove_message(self, message_id: str) -> None:
        """Remove message and all related data."""
        async with self._lock:
            if message_id in self._messages:
                del self._messages[message_id]
            if message_id in self._responses:
                del self._responses[message_id]
            if message_id in self._chat_responses:
                del self._chat_responses[message_id]


# Singleton instance
message_queue = MessageQueue()
