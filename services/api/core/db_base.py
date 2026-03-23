"""
Module database factory.

Each module gets its own MongoDB database using a shared Motor client.
Databases are named after their module (policy, messages, registry, provenance).
"""
from __future__ import annotations

import os
from typing import Optional

_client = None


def _get_client():
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI", "")
        if not uri:
            raise RuntimeError("MONGODB_URI not configured")
        from motor.motor_asyncio import AsyncIOMotorClient
        _client = AsyncIOMotorClient(uri)
    return _client


def get_module_db(db_name: str):
    """Get a named MongoDB database for a module."""
    return _get_client()[db_name]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


# Database name constants — one per module
POLICY_DB = "policy"
MESSAGES_DB = "messages"
REGISTRY_DB = "registry"
PROVENANCE_DB = "provenance"
