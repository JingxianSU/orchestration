"""
Configuration settings loaded from environment variables.
"""
from __future__ import annotations

import os
from typing import List

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Application settings from environment."""
    
    # API Keys
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Claude Models
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
    ROUTER_MODEL: str = os.getenv("ROUTER_MODEL", CLAUDE_MODEL)
    ROUTER_MAX_TOKENS: int = int(os.getenv("ROUTER_MAX_TOKENS", "200"))
    
    # MongoDB
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    
    # MCP
    MCP_SERVER_SCRIPT: str = os.getenv("MCP_SERVER_SCRIPT", "")
    MCP_PYROOT: str = os.getenv("MCP_PYROOT", "")
    BACKEND_PYTHON: str = os.getenv("BACKEND_PYTHON", "")
    
    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]
    
    # Orchestration
    ORCH_LEDGER_ANCHOR: str = os.getenv("ORCH_LEDGER_ANCHOR", "")


settings = Settings()
