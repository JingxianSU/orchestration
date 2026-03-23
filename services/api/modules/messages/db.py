"""
Messages module database — MongoDB: messages

Collections:
  messages         — ClientMessage records
  responses        — ClientResponse (status, reply, error)
  chat_responses   — ChatResponse from LLM
  policy_evals     — Policy evaluation results per message
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from core.db_base import get_module_db, MESSAGES_DB

MESSAGES_COL = "messages"
RESPONSES_COL = "responses"
CHAT_RESPONSES_COL = "chat_responses"
POLICY_EVALS_COL = "policy_evals"


def _db():
    return get_module_db(MESSAGES_DB)


async def ensure_indexes() -> None:
    db = _db()
    await db[MESSAGES_COL].create_index("message_id", unique=True)
    await db[MESSAGES_COL].create_index("trace_id")
    await db[MESSAGES_COL].create_index("timestamp_ms")
    await db[RESPONSES_COL].create_index("message_id", unique=True)
    await db[RESPONSES_COL].create_index("status")
    await db[RESPONSES_COL].create_index("updated_ms")
    await db[CHAT_RESPONSES_COL].create_index("message_id", unique=True)
    await db[POLICY_EVALS_COL].create_index("message_id", unique=True)


async def save_message(message_id: str, msg_dict: Dict[str, Any]) -> None:
    doc = {**msg_dict, "timestamp_ms": int(time.time() * 1000)}
    await _db()[MESSAGES_COL].update_one(
        {"message_id": message_id},
        {"$set": doc},
        upsert=True,
    )


async def get_message(message_id: str) -> Optional[Dict[str, Any]]:
    return await _db()[MESSAGES_COL].find_one({"message_id": message_id}, {"_id": 0})


async def save_response(message_id: str, resp_dict: Dict[str, Any]) -> None:
    doc = {**resp_dict, "updated_ms": int(time.time() * 1000)}
    await _db()[RESPONSES_COL].update_one(
        {"message_id": message_id},
        {"$set": doc},
        upsert=True,
    )


async def get_response(message_id: str) -> Optional[Dict[str, Any]]:
    return await _db()[RESPONSES_COL].find_one({"message_id": message_id}, {"_id": 0})


async def save_chat_response(message_id: str, chat_dict: Dict[str, Any]) -> None:
    await _db()[CHAT_RESPONSES_COL].update_one(
        {"message_id": message_id},
        {"$set": {**chat_dict, "message_id": message_id}},
        upsert=True,
    )


async def get_chat_response(message_id: str) -> Optional[Dict[str, Any]]:
    return await _db()[CHAT_RESPONSES_COL].find_one({"message_id": message_id}, {"_id": 0})


async def save_policy_eval(message_id: str, policy_type: str, eval_dict: Dict[str, Any]) -> None:
    await _db()[POLICY_EVALS_COL].update_one(
        {"message_id": message_id},
        {"$set": {f"evals.{policy_type}": eval_dict, "message_id": message_id}},
        upsert=True,
    )


async def get_policy_eval(message_id: str, policy_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    doc = await _db()[POLICY_EVALS_COL].find_one({"message_id": message_id}, {"_id": 0})
    if not doc:
        return None
    evals = doc.get("evals", {})
    return evals.get(policy_type) if policy_type else evals


async def list_pending_messages(limit: int = 500) -> List[Dict[str, Any]]:
    """Return messages whose response status is not yet completed/rejected — for restart recovery."""
    # Find response docs that are still in non-terminal state
    pipeline = [
        {"$match": {"status": {"$nin": ["completed", "rejected"]}}},
        {"$sort": {"updated_ms": -1}},
        {"$limit": limit},
        {"$lookup": {
            "from": MESSAGES_COL,
            "localField": "message_id",
            "foreignField": "message_id",
            "as": "msg",
        }},
        {"$unwind": "$msg"},
    ]
    cursor = _db()[RESPONSES_COL].aggregate(pipeline)
    return await cursor.to_list(length=limit)


async def list_recent_messages(limit: int = 100) -> List[Dict[str, Any]]:
    cursor = _db()[MESSAGES_COL].find({}, {"_id": 0}).sort("timestamp_ms", -1).limit(limit)
    return await cursor.to_list(length=limit)
