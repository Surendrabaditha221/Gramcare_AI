"""
Production In-Memory Rate Limiter Middleware for GramCare AI
Protects AI endpoints (/api/chat, /api/triage, /api/document) and high-cost routes from abuse
without requiring external Redis infrastructure.
"""
import time
from typing import Dict, Tuple, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Sliding window in-memory rate limiter per IP address and auth token.
    """
    def __init__(
        self,
        app,
        default_limit: int = 120,
        default_window: int = 60,
        route_limits: Dict[str, Tuple[int, int]] = None
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        # Custom limits: route prefix -> (max_requests, window_seconds)
        self.route_limits = route_limits or {
            "/api/chat": (35, 60),
            "/api/triage": (35, 60),
            "/api/document": (20, 60),
            "/api/sync": (60, 60),
        }
        # In-memory request timestamp store: key -> list of float timestamps
        self._store: Dict[str, List[float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_stale(self, now: float):
        """Periodically removes entries older than 2 minutes."""
        if now - self._last_cleanup > 120:
            self._last_cleanup = now
            stale_keys = []
            for key, timestamps in self._store.items():
                active = [t for t in timestamps if (now - t) < 120]
                if not active:
                    stale_keys.append(key)
                else:
                    self._store[key] = active
            for k in stale_keys:
                self._store.pop(k, None)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Bypass static, health, and docs endpoints
        if path in ["/health", "/docs", "/openapi.json", "/redoc", "/"] or not path.startswith("/api"):
            return await call_next(request)

        # Extract client identifier: Authorization Token UID or Client IP
        client_id = request.client.host if request.client else "unknown_client"
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # Use last 16 chars of token as client key
            token_snippet = auth_header.split(" ", 1)[1].strip()[-16:]
            client_id = f"token_{token_snippet}"

        # Determine route limit and window
        max_requests = self.default_limit
        window_seconds = self.default_window

        for prefix, (lim, win) in self.route_limits.items():
            if path.startswith(prefix):
                max_requests = lim
                window_seconds = win
                break

        key = f"{client_id}:{prefix if 'prefix' in locals() else 'api'}"
        now = time.time()

        # Clean old timestamps in sliding window
        timestamps = self._store.get(key, [])
        valid_timestamps = [t for t in timestamps if (now - t) < window_seconds]

        if len(valid_timestamps) >= max_requests:
            retry_after = int(window_seconds - (now - valid_timestamps[0])) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please wait before submitting additional requests.",
                    "retry_after_seconds": max(1, retry_after)
                },
                headers={"Retry-After": str(max(1, retry_after))}
            )

        valid_timestamps.append(now)
        self._store[key] = valid_timestamps

        # Housekeeping
        self._cleanup_stale(now)

        response = await call_next(request)
        return response
