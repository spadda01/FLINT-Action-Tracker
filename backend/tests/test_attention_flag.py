from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.adapters.mock_action_items import MOCK_ACTION_ITEMS
from app.main import app

P = "/api/boards/project-1"


@pytest.fixture
def client(monkeypatch):
    # user-1 can open project-1. Each test gets its own copy of the sample items.
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    monkeypatch.setitem(MOCK_ACTION_ITEMS, "project-1", deepcopy(MOCK_ACTION_ITEMS["project-1"]))
    with TestClient(app) as test_client:
        yield test_client


def item(client, item_id):
    return next(i for i in client.get(f"{P}/items").json() if i["id"] == item_id)


def test_flag_is_saved_without_changing_status_or_anything_else(client):
    before = item(client, 2)

    response = client.patch(f"{P}/items/2", json={"attention": not before["attention"]})

    assert response.status_code == 200
    after = item(client, 2)
    assert after["attention"] is not before["attention"]
    assert {**after, "attention": before["attention"]} == before


def test_flag_can_be_set_and_cleared(client):
    assert client.patch(f"{P}/items/2", json={"attention": True}).json()["attention"] is True
    assert client.patch(f"{P}/items/2", json={"attention": False}).json()["attention"] is False
    assert item(client, 2)["attention"] is False


def test_flag_must_be_true_or_false(client):
    assert client.patch(f"{P}/items/2", json={"attention": "yes please"}).status_code == 422
    assert client.patch(f"{P}/items/2", json={"attention": None}).status_code == 422


def test_non_member_cannot_flag(client, monkeypatch):
    # user-2 is not a member of project-1.
    flagged = item(client, 2)["attention"]
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    assert client.patch(f"{P}/items/2", json={"attention": not flagged}).status_code == 404

    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    assert item(client, 2)["attention"] is flagged
