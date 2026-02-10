"""
Configuration API endpoints for system modules.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/config", tags=["Configuration"])


# ============ Models ============

class LLMConfig(BaseModel):
    """LLM configuration."""
    provider: str = "anthropic"
    model: str = ""
    api_key_configured: bool = False
    api_key_preview: str = ""  # Show last 4 chars only
    max_tokens: int = 1200
    available_models: List[str] = []


class LLMConfigUpdate(BaseModel):
    """LLM configuration update request."""
    api_key: Optional[str] = None  # Only update if provided
    model: Optional[str] = None
    max_tokens: Optional[int] = None


class DatabaseConfig(BaseModel):
    """Database configuration."""
    provider: str = "mongodb"
    uri_configured: bool = False
    uri_preview: str = ""  # Masked URI
    database: str = ""
    collection: str = ""
    connected: bool = False


class DatabaseConfigUpdate(BaseModel):
    """Database configuration update request."""
    uri: Optional[str] = None
    database: Optional[str] = None
    collection: Optional[str] = None


class TestConnectionResult(BaseModel):
    """Connection test result."""
    success: bool
    message: str
    latency_ms: Optional[int] = None


# ============ LLM Endpoints ============

AVAILABLE_CLAUDE_MODELS = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
]


@router.get("/llm", response_model=LLMConfig)
async def get_llm_config() -> LLMConfig:
    """Get current LLM configuration."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
    max_tokens = int(os.getenv("CLAUDE_MAX_TOKENS", "1200"))
    
    return LLMConfig(
        provider="anthropic",
        model=model,
        api_key_configured=bool(api_key),
        api_key_preview=f"...{api_key[-4:]}" if len(api_key) >= 4 else "",
        max_tokens=max_tokens,
        available_models=AVAILABLE_CLAUDE_MODELS,
    )


@router.put("/llm", response_model=LLMConfig)
async def update_llm_config(update: LLMConfigUpdate) -> LLMConfig:
    """Update LLM configuration (runtime only, doesn't persist to .env)."""
    if update.api_key is not None:
        os.environ["ANTHROPIC_API_KEY"] = update.api_key
    if update.model is not None:
        os.environ["CLAUDE_MODEL"] = update.model
    if update.max_tokens is not None:
        os.environ["CLAUDE_MAX_TOKENS"] = str(update.max_tokens)
    
    return await get_llm_config()


@router.post("/llm/test", response_model=TestConnectionResult)
async def test_llm_connection() -> TestConnectionResult:
    """Test LLM API connection."""
    import time
    from anthropic import AsyncAnthropic
    
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return TestConnectionResult(
            success=False,
            message="API key not configured"
        )
    
    try:
        client = AsyncAnthropic(api_key=api_key)
        model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
        
        start = time.time()
        response = await client.messages.create(
            model=model,
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}]
        )
        latency = int((time.time() - start) * 1000)
        
        return TestConnectionResult(
            success=True,
            message=f"Connected to {model}",
            latency_ms=latency
        )
    except Exception as e:
        return TestConnectionResult(
            success=False,
            message=str(e)
        )


# ============ Database Endpoints ============

def mask_uri(uri: str) -> str:
    """Mask sensitive parts of URI."""
    if not uri:
        return ""
    # Simple masking: show protocol and last part
    if "://" in uri:
        proto, rest = uri.split("://", 1)
        if "@" in rest:
            # Has credentials
            creds, host = rest.rsplit("@", 1)
            return f"{proto}://****@{host}"
        return f"{proto}://{rest[:10]}..."
    return uri[:10] + "..."


@router.get("/database", response_model=DatabaseConfig)
async def get_database_config() -> DatabaseConfig:
    """Get current database configuration."""
    uri = os.getenv("MONGODB_URI", "")
    database = os.getenv("MONGODB_DB", "orch")
    collection = os.getenv("MONGODB_PROV_COLLECTION", "prov_events")
    
    # Check if connected by trying to import the mongo instance
    connected = False
    try:
        from main import _mongo
        connected = _mongo is not None
    except:
        pass
    
    return DatabaseConfig(
        provider="mongodb",
        uri_configured=bool(uri),
        uri_preview=mask_uri(uri),
        database=database,
        collection=collection,
        connected=connected,
    )


@router.put("/database", response_model=DatabaseConfig)
async def update_database_config(update: DatabaseConfigUpdate) -> DatabaseConfig:
    """Update database configuration (runtime only)."""
    if update.uri is not None:
        os.environ["MONGODB_URI"] = update.uri
    if update.database is not None:
        os.environ["MONGODB_DB"] = update.database
    if update.collection is not None:
        os.environ["MONGODB_PROV_COLLECTION"] = update.collection
    
    return await get_database_config()


@router.post("/database/test", response_model=TestConnectionResult)
async def test_database_connection() -> TestConnectionResult:
    """Test database connection."""
    import time
    
    uri = os.getenv("MONGODB_URI", "")
    if not uri:
        return TestConnectionResult(
            success=False,
            message="MongoDB URI not configured"
        )
    
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        
        database = os.getenv("MONGODB_DB", "orch")
        
        start = time.time()
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        # Ping to test connection
        await client.admin.command("ping")
        latency = int((time.time() - start) * 1000)
        
        # Check if database exists
        db_list = await client.list_database_names()
        db_exists = database in db_list
        
        client.close()
        
        return TestConnectionResult(
            success=True,
            message=f"Connected to MongoDB. Database '{database}' {'exists' if db_exists else 'will be created'}.",
            latency_ms=latency
        )
    except Exception as e:
        return TestConnectionResult(
            success=False,
            message=str(e)
        )


# ============ Save to .env ============

class SaveConfigRequest(BaseModel):
    """Request to save configuration to .env file."""
    llm: Optional[LLMConfigUpdate] = None
    database: Optional[DatabaseConfigUpdate] = None


@router.post("/save")
async def save_config_to_env(request: SaveConfigRequest) -> Dict[str, Any]:
    """Save configuration changes to .env file."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    # Read existing .env
    env_lines: List[str] = []
    env_vars: Dict[str, str] = {}
    
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key = line.split("=", 1)[0].strip()
                    if key.startswith("export "):
                        key = key[7:].strip()
                    env_vars[key] = line
                env_lines.append(line)
    
    changes: List[str] = []
    
    # Update LLM config
    if request.llm:
        if request.llm.api_key is not None:
            env_vars["ANTHROPIC_API_KEY"] = f"ANTHROPIC_API_KEY={request.llm.api_key}"
            os.environ["ANTHROPIC_API_KEY"] = request.llm.api_key
            changes.append("ANTHROPIC_API_KEY")
        if request.llm.model is not None:
            env_vars["CLAUDE_MODEL"] = f"CLAUDE_MODEL={request.llm.model}"
            os.environ["CLAUDE_MODEL"] = request.llm.model
            changes.append("CLAUDE_MODEL")
        if request.llm.max_tokens is not None:
            env_vars["CLAUDE_MAX_TOKENS"] = f"CLAUDE_MAX_TOKENS={request.llm.max_tokens}"
            os.environ["CLAUDE_MAX_TOKENS"] = str(request.llm.max_tokens)
            changes.append("CLAUDE_MAX_TOKENS")
    
    # Update Database config
    if request.database:
        if request.database.uri is not None:
            env_vars["MONGODB_URI"] = f"MONGODB_URI={request.database.uri}"
            os.environ["MONGODB_URI"] = request.database.uri
            changes.append("MONGODB_URI")
        if request.database.database is not None:
            env_vars["MONGODB_DB"] = f"MONGODB_DB={request.database.database}"
            os.environ["MONGODB_DB"] = request.database.database
            changes.append("MONGODB_DB")
        if request.database.collection is not None:
            env_vars["MONGODB_PROV_COLLECTION"] = f"MONGODB_PROV_COLLECTION={request.database.collection}"
            os.environ["MONGODB_PROV_COLLECTION"] = request.database.collection
            changes.append("MONGODB_PROV_COLLECTION")
    
    # Write back to .env
    with open(env_path, "w") as f:
        written_keys = set()
        for line in env_lines:
            if line and not line.startswith("#") and "=" in line:
                key = line.split("=", 1)[0].strip()
                if key.startswith("export "):
                    key = key[7:].strip()
                if key in env_vars:
                    f.write(env_vars[key] + "\n")
                    written_keys.add(key)
                else:
                    f.write(line + "\n")
            else:
                f.write(line + "\n")
        
        # Add new keys
        for key, value in env_vars.items():
            if key not in written_keys:
                f.write(value + "\n")
    
    return {
        "success": True,
        "changes": changes,
        "message": f"Updated {len(changes)} configuration(s). Restart API to apply database changes."
    }
