import pytest
from fastapi.testclient import TestClient

from app.api import auth
from app.main import app

AUTH_HEADERS = {"X-Mock-Auth": "1"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.delitem(app.dependency_overrides, auth.get_current_user_id)
    monkeypatch.setattr(auth, "_sessions", {})
    with TestClient(app) as browser:
        yield browser


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/api/me", None),
        ("GET", "/api/boards", None),
        ("GET", "/api/boards/project-1", None),
        ("GET", "/api/boards/project-1/items", None),
        ("GET", "/api/boards/project-1/items/archived", None),
        ("GET", "/api/boards/project-1/sections", None),
        ("GET", "/api/boards/project-1/statuses", None),
        ("GET", "/api/boards/project-1/employees", None),
        ("GET", "/api/boards/project-1/priorities", None),
        ("GET", "/api/boards/project-1/items/1/history", None),
        ("GET", "/api/priorities", None),
        ("GET", "/api/organizations", None),
        ("GET", "/api/companies", None),
        ("GET", "/api/employees", None),
        ("GET", "/api/projects", None),
        ("GET", "/api/groups", None),
        ("POST", "/api/boards/team", {}),
        ("POST", "/api/boards/project-1/sections", {"name": "Synthetic section"}),
        ("POST", "/api/boards/project-1/items/1/restore", None),
        ("PATCH", "/api/boards/project-1/items/1/priority", {"priority": "Low"}),
    ],
)
def test_protected_api_rejects_client_supplied_identity(client, monkeypatch, method, path, body):
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    client.cookies.set(auth.SESSION_COOKIE, "user-1", path="/api")
    response = client.request(
        method, path, json=body, params={"user_id": "user-1"},
        headers={"X-User-Id": "user-1", "X-Mock-Role": "admin", "Authorization": "Bearer synthetic"},
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Sign in to continue."}
    assert response.headers["cache-control"] == "no-store"


def test_sign_in_uses_server_identity_and_preserves_board_permissions(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "user-2")
    response = client.post(
        "/api/auth/sign-in",
        headers={**AUTH_HEADERS, "X-User-Id": "user-2"},
        json={"user_id": "user-2", "tenant_id": auth.MOCK_TENANT},
    )
    assert response.status_code == 204
    assert response.content == b""
    cookie = response.headers["set-cookie"].lower()
    assert all(attribute in cookie for attribute in ("httponly", "samesite=strict", "path=/api"))
    assert client.get("/api/me").json() == {"id": "user-1"}
    assert client.get("/api/boards/project-1/sections").status_code == 200
    assert client.get("/api/boards/team-restricted").status_code == 404
    assert client.get("/api/boards/team-restricted/statuses").status_code == 404
    assert client.get("/api/boards/team-restricted/priorities").status_code == 403


@pytest.mark.parametrize(
    "identity",
    [auth.MockIdentity("user-1", "another-synthetic-tenant"),
     auth.MockIdentity("unknown-user", auth.MOCK_TENANT)],
)
def test_sign_in_rejects_unverified_mock_identity(client, monkeypatch, identity):
    monkeypatch.setitem(app.dependency_overrides, auth.get_mock_identity, lambda: identity)
    response = client.post(
        "/api/auth/sign-in", headers=AUTH_HEADERS, json={"tenant_id": auth.MOCK_TENANT}
    )
    assert response.status_code == 403
    assert "set-cookie" not in response.headers
    assert client.get("/api/boards").status_code == 401


def test_sign_out_revokes_session_and_clears_cookie(client):
    assert client.post("/api/auth/sign-in").status_code == 403
    assert client.post("/api/auth/sign-in", headers=AUTH_HEADERS).status_code == 204
    original = client.cookies.get(auth.SESSION_COOKIE)
    assert client.post("/api/auth/sign-out").status_code == 403
    assert client.get("/api/me").status_code == 200
    response = client.post("/api/auth/sign-out", headers=AUTH_HEADERS)
    assert response.status_code == 204
    assert "max-age=0" in response.headers["set-cookie"].lower()
    assert client.cookies.get(auth.SESSION_COOKIE) is None
    client.cookies.set(auth.SESSION_COOKIE, original, path="/api")
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/boards/project-1/items").status_code == 401
    assert client.post("/api/auth/sign-out", headers=AUTH_HEADERS).status_code == 204


def test_activity_renews_session_but_background_checks_do_not(client, monkeypatch):
    now = 0
    monkeypatch.setattr(auth, "monotonic", lambda: now)
    assert client.post("/api/auth/sign-in", headers=AUTH_HEADERS).status_code == 204

    now = auth.IDLE_TIMEOUT_SECONDS - 1
    assert client.get("/api/boards").status_code == 200
    now += auth.IDLE_TIMEOUT_SECONDS - 1
    assert client.get("/api/auth/session").status_code == 204

    now += 1
    assert client.get("/api/auth/session").status_code == 401
    assert client.get("/api/boards").status_code == 401
    assert client.post("/api/auth/sign-in", headers=AUTH_HEADERS).status_code == 204
    assert client.get("/api/me").status_code == 200


def test_non_mock_mode_disables_authentication_and_data(client, monkeypatch):
    assert client.post("/api/auth/sign-in", headers=AUTH_HEADERS).status_code == 204
    monkeypatch.setenv("APP_MODE", "entra")
    for path in ("/api/auth/session", "/api/me", "/api/projects"):
        assert client.get(path).status_code == 503
    assert client.post("/api/auth/sign-in", headers=AUTH_HEADERS).status_code == 503
