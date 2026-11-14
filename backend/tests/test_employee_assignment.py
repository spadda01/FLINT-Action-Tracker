from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.adapters.mock_action_items import MOCK_ACTION_ITEMS
from app.main import app

P = "/api/boards/project-1"

SARAH = {"name": "Sarah Lee", "isExternal": False, "employeeId": "E002"}
JAMES = {"name": "James Ortiz", "isExternal": False, "employeeId": "E005"}
DANA = {"name": "Dana Whitfield", "isExternal": False, "employeeId": "E008"}


@pytest.fixture
def client(monkeypatch):
    # user-1 can open project-1. Each test gets its own copy of the sample
    # items; monkeypatch puts the originals back afterwards.
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    monkeypatch.setitem(MOCK_ACTION_ITEMS, "project-1", deepcopy(MOCK_ACTION_ITEMS["project-1"]))
    with TestClient(app) as test_client:
        yield test_client


def set_owners(client, item_id, owners, **other):
    return client.patch(f"{P}/items/{item_id}", json={"owners": owners, **other})


def item(client, item_id):
    return next(i for i in client.get(f"{P}/items").json() if i["id"] == item_id)


# --- Assigning staff ---

def test_active_employee_can_be_assigned(client):
    response = set_owners(client, 1, [SARAH])

    assert response.status_code == 200
    assert item(client, 1)["owners"] == [SARAH]


def test_name_comes_from_the_employee_records(client):
    response = set_owners(client, 1, [{"name": "sarah", "isExternal": False, "employeeId": "E002"}])

    assert response.json()["owners"][0]["name"] == "Sarah Lee"


def test_staff_and_free_text_owners_can_share_an_item(client):
    owners = [SARAH, {"name": "Carrier", "isExternal": True, "employeeId": None}]

    assert set_owners(client, 1, owners).json()["owners"] == owners


def test_unlinked_staff_owners_are_still_allowed(client):
    # Owners typed before staff search existed have no employee record.
    response = set_owners(client, 1, [{"name": "Austin", "isExternal": False}])

    assert response.status_code == 200


# --- Inactive employees ---

def test_inactive_employee_cannot_be_newly_assigned(client):
    before = item(client, 1)["owners"]

    response = set_owners(client, 1, [SARAH, DANA])

    assert response.status_code == 422
    assert response.json()["detail"] == "Dana Whitfield is inactive and can't be assigned."
    assert item(client, 1)["owners"] == before


def test_inactive_owner_stays_on_items_they_already_own(client):
    # Item 2 already has Dana, who has since left. Adding Sarah keeps her.
    response = set_owners(client, 2, [JAMES, DANA, SARAH])

    assert response.status_code == 200
    assert [o["name"] for o in response.json()["owners"]] == ["James Ortiz", "Dana Whitfield", "Sarah Lee"]


def test_inactive_owner_can_be_removed_but_not_added_back(client):
    assert set_owners(client, 2, [JAMES]).status_code == 200

    assert set_owners(client, 2, [JAMES, DANA]).status_code == 422


def test_inactive_employee_cannot_be_assigned_to_a_new_item(client):
    response = client.post(f"{P}/items", json={"title": "Order rebar", "owners": [DANA]})

    assert response.status_code == 422
    assert all(i["title"] != "Order rebar" for i in client.get(f"{P}/items").json())


def test_new_item_can_have_staff_owners(client):
    response = client.post(f"{P}/items", json={"title": "Order rebar", "owners": [SARAH]})

    assert response.status_code == 201
    assert response.json()["owners"] == [SARAH]


# --- Invalid assignments ---

def test_unknown_employee_is_rejected(client):
    response = set_owners(client, 1, [{"name": "Ghost", "isExternal": False, "employeeId": "E999"}])

    assert response.status_code == 422
    assert response.json()["detail"] == "Choose a person from FLINT's employee records."


def test_external_owner_cannot_be_linked_to_an_employee(client):
    response = set_owners(client, 1, [{**SARAH, "isExternal": True}])

    assert response.status_code == 422
    assert response.json()["detail"] == "Only FLINT staff can be linked to an employee record."


def test_same_person_cannot_be_added_twice(client):
    response = set_owners(client, 1, [SARAH, SARAH])

    assert response.status_code == 422
    assert response.json()["detail"] == "Sarah Lee is already an owner of this item."


def test_rejected_owners_save_nothing_else(client):
    response = set_owners(client, 1, [DANA], title="Changed title", status="Complete")

    assert response.status_code == 422
    saved = item(client, 1)
    assert saved["title"] == "Review construction drawings"
    assert saved["status"] == "In Progress"


# --- Access ---

def test_non_member_cannot_assign(client, monkeypatch):
    # user-2 is not a member of project-1.
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    assert set_owners(client, 1, [SARAH]).status_code == 404
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    assert SARAH not in item(client, 1)["owners"]


def test_unknown_user_cannot_assign(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "someone-else")

    assert set_owners(client, 1, [SARAH]).status_code == 401


# --- Sample data ---

def test_sample_items_show_a_historical_inactive_owner(client):
    ids = [o["employeeId"] for o in item(client, 2)["owners"]]
    looked_up = client.get(f"{P}/employees", params={"ids": ",".join(ids)}).json()

    assert {e["name"]: e["active"] for e in looked_up} == {"James Ortiz": True, "Dana Whitfield": False}
