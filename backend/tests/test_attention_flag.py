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


# --- History (AT-168) ---

def history(client, item_id):
    # Newest first. History is shared across tests, so only look at the newest entries.
    return client.get(f"{P}/items/{item_id}/history").json()


def test_setting_and_clearing_a_flag_is_recorded_in_history(client):
    client.patch(f"{P}/items/2", json={"attention": True})
    newest = history(client, 2)[0]
    assert (newest["field"], newest["oldValue"], newest["newValue"]) == ("attention", False, True)
    assert newest["actorId"] == "user-1"

    client.patch(f"{P}/items/2", json={"attention": False})
    newest = history(client, 2)[0]
    assert (newest["field"], newest["oldValue"], newest["newValue"]) == ("attention", True, False)


# --- Start new week (AT-168) ---

RESET = f"{P}/attention/reset"


def test_start_new_week_clears_every_flag_on_the_board(client):
    client.patch(f"{P}/items/2", json={"attention": True})
    flagged = [i["id"] for i in client.get(f"{P}/items").json() if i["attention"]]
    assert len(flagged) == 2

    response = client.post(RESET)

    assert response.status_code == 200
    assert sorted(response.json()["clearedItemIds"]) == sorted(flagged)
    assert not any(i["attention"] for i in client.get(f"{P}/items").json())


def test_start_new_week_records_each_cleared_flag_in_history(client):
    flagged = [i["id"] for i in client.get(f"{P}/items").json() if i["attention"]]

    client.post(RESET)

    for item_id in flagged:
        newest = history(client, item_id)[0]
        assert (newest["field"], newest["oldValue"], newest["newValue"]) == ("attention", True, False)
        assert newest["actorId"] == "user-1"


def test_start_new_week_leaves_unflagged_items_and_status_alone(client):
    before = client.get(f"{P}/items").json()
    unflagged = next(i for i in before if not i["attention"])
    history_before = len(history(client, unflagged["id"]))

    client.post(RESET)

    after = {i["id"]: i for i in client.get(f"{P}/items").json()}
    for item_before in before:
        assert after[item_before["id"]] == {**item_before, "attention": False}
    assert len(history(client, unflagged["id"])) == history_before


def test_start_new_week_only_changes_this_board(client, monkeypatch):
    # user-1 is also a member of project-2; give it a flagged item.
    monkeypatch.setitem(MOCK_ACTION_ITEMS, "project-2", [])
    client.post("/api/boards/project-2/items", json={"title": "Other board", "attention": True})

    client.post(RESET)

    assert client.get("/api/boards/project-2/items").json()[0]["attention"] is True


def test_start_new_week_with_nothing_flagged_clears_nothing(client):
    client.post(RESET)

    response = client.post(RESET)

    assert response.status_code == 200
    assert response.json() == {"clearedItemIds": []}


def test_non_member_cannot_start_a_new_week(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    assert client.post(RESET).status_code == 404

    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    assert any(i["attention"] for i in client.get(f"{P}/items").json())


def test_unknown_user_cannot_start_a_new_week(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "someone-else")

    assert client.post(RESET).status_code == 401


def test_start_new_week_is_off_outside_mock_mode(client, monkeypatch):
    monkeypatch.delenv("APP_MODE")

    assert client.post(RESET).status_code == 503
