from collections import deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """Sliding-window limiter. Keys whose window has emptied are deleted, so
    memory stays bounded by the number of recently active clients."""

    # Sweep every key for expired windows after this many checks.
    SWEEP_EVERY = 1000

    def __init__(self, limit: int, window_seconds: int) -> None:
        if limit < 1 or window_seconds < 1:
            raise ValueError("Rate-limit limit and window must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()
        self._checks = 0

    def _prune(self, key: str, cutoff: float) -> deque[float] | None:
        events = self._events.get(key)
        if events is None:
            return None
        while events and events[0] <= cutoff:
            events.popleft()
        if not events:
            del self._events[key]
            return None
        return events

    def check(self, key: str) -> None:
        now = monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            self._checks += 1
            if self._checks % self.SWEEP_EVERY == 0:
                for stale_key in list(self._events):
                    self._prune(stale_key, cutoff)
            events = self._prune(key, cutoff)
            if events is not None and len(events) >= self.limit:
                retry_after = max(1, int(events[0] + self.window_seconds - now))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many coaching requests. Try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            self._events.setdefault(key, deque()).append(now)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


coaching_rate_limiter = InMemoryRateLimiter(limit=20, window_seconds=60)


def rate_limit_key(request: Request, user_id: str | None) -> str:
    """Signed-in users are limited per account, so people sharing one network
    (one IP address) do not share a limit; anonymous callers per IP."""
    if user_id:
        return f"user:{user_id}"
    return f"ip:{request.client.host if request.client else 'unknown'}"
