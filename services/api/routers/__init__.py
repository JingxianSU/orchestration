from .health import router as health_router
from .stream import router as stream_router
from .client import router as client_router
from .admin import router as admin_router
from .provenance import router as provenance_router
from .mcp import router as mcp_router
from .registry import router as registry_router
from .config import router as config_router
from .policy import router as policy_router
from .logs import router as logs_router

__all__ = [
    "health_router",
    "stream_router",
    "client_router",
    "admin_router",
    "provenance_router",
    "mcp_router",
    "registry_router",
    "config_router",
    "policy_router",
    "logs_router",
]
