"""Local synthetic authentication. Real Entra integration is pending authorization."""

import os
from dataclasses import dataclass
from secrets import token_urlsafe
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.services.board_access import MOCK_EMPLOYEE_IDS

router = APIRouter(prefix="/api/auth", tags=["Mock authentication"])
SESSION_COOKIE = "flint_mock_session"
MOCK_TENANT = "flint-synthetic-tenant"
IDLE_TIMEOUT_SECONDS = 15 * 60


@dataclass(frozen=True)
class MockIdentity:
    user_id: str
    tenant_id: str


@dataclass
class MockSession:
    user_id: str
    expires_at: float


_sessions: dict[str, MockSession] = {}
_session_lock = Lock()


def require_mock_mode() -> None:
    if os.getenv("APP_MODE") != "mock":
        raise HTTPException(
            status_code=503, detail="Backend integration is not configured."
        )


def get_mock_identity() -> MockIdentity:
    # This local stand-in selects a fixed fixture. The browser supplies no claims.
    return MockIdentity(user_id="user-1", tenant_id=MOCK_TENANT)


def _get_session(request: Request, *, renew: bool) -> str:
    require_mock_mode()
    session_id = request.cookies.get(SESSION_COOKIE, "")
    with _session_lock:
        now = monotonic()
        session = _sessions.get(session_id)
        if session is None or session.expires_at <= now:
            _sessions.pop(session_id, None)
            raise HTTPException(status_code=401, detail="Sign in to continue.")
        if renew:
            session.expires_at = now + IDLE_TIMEOUT_SECONDS
        return session.user_id


def get_current_user_id(request: Request) -> str:
    return _get_session(request, renew=True)


def require_mock_auth_request(request: Request) -> None:
    require_mock_mode()
    # Cross-origin HTML forms cannot set this header, and the API allows no CORS.
    if request.headers.get("X-Mock-Auth") != "1":
        raise HTTPException(status_code=403, detail="Mock authentication request denied.")


@router.post("/sign-in", status_code=204, dependencies=[Depends(require_mock_auth_request)])
def sign_in(
    request: Request,
    response: Response,
    identity: MockIdentity = Depends(get_mock_identity),
) -> None:
    if identity.tenant_id != MOCK_TENANT or identity.user_id not in MOCK_EMPLOYEE_IDS:
        raise HTTPException(status_code=403, detail="Mock identity is not authorized.")

    session_id = token_urlsafe(32)
    with _session_lock:
        now = monotonic()
        for expired_id in [
            key for key, session in _sessions.items() if session.expires_at <= now
        ]:
            del _sessions[expired_id]
        _sessions.pop(request.cookies.get(SESSION_COOKIE, ""), None)
        _sessions[session_id] = MockSession(identity.user_id, now + IDLE_TIMEOUT_SECONDS)

    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        path="/api",
        httponly=True,
        samesite="strict",
        secure=request.url.scheme == "https",
    )


@router.post("/sign-out", status_code=204, dependencies=[Depends(require_mock_auth_request)])
def sign_out(request: Request, response: Response) -> None:
    with _session_lock:
        _sessions.pop(request.cookies.get(SESSION_COOKIE, ""), None)
    response.delete_cookie(
        SESSION_COOKIE,
        path="/api",
        httponly=True,
        samesite="strict",
        secure=request.url.scheme == "https",
    )


@router.get("/session", status_code=204)
def check_session(request: Request) -> None:
    _get_session(request, renew=False)
