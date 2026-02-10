"""
HTTP Logging Middleware for FastAPI.

Captures all incoming HTTP requests and responses.
"""
from __future__ import annotations

import time
import json
from typing import Callable, Awaitable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.types import ASGIApp

from services.http_logger import http_logger


class HttpLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all HTTP requests and responses.

    Captures request/response details and publishes them
    to the HTTP logger for real-time monitoring.
    """

    # Paths to exclude from logging (to avoid noise)
    EXCLUDE_PATHS = {
        "/api/stream",  # SSE stream - would create infinite loop
        "/api/logs/stream",  # Log stream endpoint
        "/api/health",  # Health check - too frequent
        "/favicon.ico",
    }

    # Content types to capture body for
    CAPTURE_BODY_TYPES = {
        "application/json",
        "text/plain",
        "text/html",
        "application/x-www-form-urlencoded",
    }

    def __init__(self, app: ASGIApp, max_body_size: int = 10000) -> None:
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Process request and log it."""
        # Skip excluded paths
        if request.url.path in self.EXCLUDE_PATHS:
            return await call_next(request)

        start_time = time.time()

        # Capture request details
        method = request.method
        url = str(request.url)

        # Get request headers (filter sensitive ones)
        request_headers = self._filter_headers(dict(request.headers))

        # Try to capture request body
        request_body = None
        content_type = request.headers.get("content-type", "")
        if any(ct in content_type for ct in self.CAPTURE_BODY_TYPES):
            try:
                body_bytes = await request.body()
                if len(body_bytes) <= self.max_body_size:
                    request_body = body_bytes.decode("utf-8", errors="replace")
                else:
                    request_body = f"[Body too large: {len(body_bytes)} bytes]"
            except Exception:
                request_body = "[Could not read body]"

        # Get trace ID if present
        trace_id = request.headers.get("x-trace-id")

        # Call the actual endpoint
        error_message = None
        response = None
        try:
            response = await call_next(request)
        except Exception as e:
            error_message = str(e)
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000

            # Capture response details
            status_code = response.status_code if response else 500
            response_headers = {}
            response_body = None

            if response and not isinstance(response, StreamingResponse):
                response_headers = self._filter_headers(dict(response.headers))

                # Try to capture response body for non-streaming responses
                # Note: This is tricky with Starlette, we'll skip body capture for now
                # to avoid complications with response consumption

            # Log the request
            await http_logger.log_request(
                direction="inbound",
                method=method,
                url=url,
                status_code=status_code,
                request_headers=request_headers,
                response_headers=response_headers,
                request_body=request_body,
                response_body=response_body,
                duration_ms=duration_ms,
                error=error_message,
                trace_id=trace_id,
            )

        return response

    def _filter_headers(self, headers: dict) -> dict:
        """Filter out sensitive headers."""
        sensitive_keys = {
            "authorization",
            "cookie",
            "set-cookie",
            "x-api-key",
            "api-key",
            "x-auth-token",
        }
        return {
            k: ("***" if k.lower() in sensitive_keys else v)
            for k, v in headers.items()
        }
