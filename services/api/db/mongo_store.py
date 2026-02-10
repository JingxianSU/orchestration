"""
MongoDB store for provenance events.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


class MongoStore:
    """MongoDB store for provenance events."""
    
    def __init__(self, connection_string: str, database: str = "orch", collection: str = "prov_events") -> None:
        self.connection_string = connection_string
        self.database_name = database
        self.collection_name = collection
        self._db = None
        self._client = None

    async def connect(self) -> None:
        """Connect to MongoDB."""
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            self._client = AsyncIOMotorClient(self.connection_string)
            self._db = self._client[self.database_name]
            
            # Ensure indexes
            await self._db[self.collection_name].create_index("provenance.event_id", unique=True)
            await self._db[self.collection_name].create_index("provenance.trace_id")
            await self._db[self.collection_name].create_index("provenance.session_id")
            await self._db[self.collection_name].create_index("timestamp_ms")
            
            print(f"[MONGO] Connected to MongoDB: {self.database_name}")
        except Exception as e:
            print(f"[MONGO] Error connecting to MongoDB: {e}")
            raise

    async def close(self) -> None:
        """Close MongoDB connection."""
        if self._client:
            self._client.close()
            print("[MONGO] Connection closed")

    async def insert_prov_event(self, doc: Dict[str, Any]) -> None:
        """Insert a provenance event document."""
        if self._db is None:
            raise RuntimeError("MongoDB not connected")
        await self._db[self.collection_name].insert_one(doc)

    async def get_prov_event_by_event_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Get a provenance event by event_id."""
        if self._db is None:
            raise RuntimeError("MongoDB not connected")
        return await self._db[self.collection_name].find_one({"provenance.event_id": event_id})

    async def get_last_event_hash(
        self,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None
    ) -> Optional[str]:
        """Get the hash of the last event for chaining."""
        if self._db is None:
            raise RuntimeError("MongoDB not connected")
        
        query: Dict[str, Any] = {}
        if session_id:
            query["provenance.session_id"] = session_id
        if trace_id:
            query["provenance.trace_id"] = trace_id
        
        cursor = self._db[self.collection_name].find(query).sort("timestamp_ms", -1).limit(1)
        docs = await cursor.to_list(length=1)
        
        if docs:
            prov = docs[0].get("provenance", {})
            return prov.get("event_hash")
        return None

    async def list_prov_events(
        self,
        limit: int = 50,
        cursor: Optional[str] = None,
        session_id: Optional[str] = None,
        trace_id: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """List provenance events with pagination."""
        if self._db is None:
            raise RuntimeError("MongoDB not connected")
        
        query: Dict[str, Any] = {}
        if session_id:
            query["provenance.session_id"] = session_id
        if trace_id:
            query["provenance.trace_id"] = trace_id
        
        if cursor:
            try:
                cursor_ts = int(cursor)
                query["timestamp_ms"] = {"$lt": cursor_ts}
            except:
                pass
        
        cursor_db = self._db[self.collection_name].find(query).sort("timestamp_ms", -1).limit(limit + 1)
        docs = await cursor_db.to_list(length=limit + 1)
        
        next_cursor: Optional[str] = None
        if len(docs) > limit:
            docs = docs[:limit]
            if docs:
                next_cursor = str(docs[-1].get("timestamp_ms", ""))
        
        return docs, next_cursor
