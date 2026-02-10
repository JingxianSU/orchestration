"""
Common utility functions.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import anthropic


def now_ms() -> int:
    """Current time in milliseconds (monotonic)."""
    return int(time.perf_counter() * 1000)


def iso_utc_now() -> str:
    """ISO 8601 formatted UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


def canonical_json_bytes(obj: Any) -> bytes:
    """Convert object to canonical JSON bytes for hashing."""
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return s.encode("utf-8")


def sha256_hex(data: bytes) -> str:
    """SHA256 hash as hex string."""
    return hashlib.sha256(data).hexdigest()


def obj_to_jsonable(x: Any) -> Any:
    """Convert any object to JSON-serializable form."""
    if x is None:
        return None
    if isinstance(x, (str, int, float, bool)):
        return x
    if isinstance(x, list):
        return [obj_to_jsonable(i) for i in x]
    if isinstance(x, dict):
        return {str(k): obj_to_jsonable(v) for k, v in x.items()}
    if hasattr(x, "model_dump"):
        return x.model_dump()
    if hasattr(x, "__dict__"):
        try:
            return obj_to_jsonable(vars(x))
        except Exception:
            return str(x)
    return str(x)


def extract_text(resp: Any) -> str:
    """Extract text content from Claude response."""
    parts: List[str] = []
    for block in getattr(resp, "content", []) or []:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", ""))
    return "\n".join([p for p in parts if p.strip()]).strip()


def parse_json_maybe_fenced(text: str) -> Dict[str, Any]:
    """Parse JSON that might be wrapped in markdown code fences."""
    if not text:
        return {}
    t = text.strip()
    
    # Try direct parse
    try:
        return json.loads(t)
    except Exception:
        pass
    
    # Try extracting from code fence
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", t, flags=re.DOTALL | re.IGNORECASE)
    if m:
        inner = m.group(1).strip()
        try:
            return json.loads(inner)
        except Exception:
            return {}
    
    # Try extracting any JSON object
    m2 = re.search(r"(\{.*\})", t, flags=re.DOTALL)
    if m2:
        try:
            return json.loads(m2.group(1))
        except Exception:
            return {}
    
    return {}


def get_anthropic_client() -> anthropic.Anthropic:
    """Get configured Anthropic client."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    return anthropic.Anthropic(api_key=api_key)
