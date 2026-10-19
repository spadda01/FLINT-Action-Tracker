import pytest
from fastapi.testclient import TestClient

from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.api.boards import get_board_service
from app.db.board_repository import InMemoryBoardRepository
from app.main import app
from app.services.board_service import BoardService


@pytest.fixture
def created_client(monkeypatch):
    monkeypatch.setenv('APP_MODE', 'mock')
    monkeypatch.setenv('MOCK_USER_ID', 'user-1')
    service = BoardService(
        InMemoryBoardRepository(), MockEmployeeService(), MockGroupService(),
    )
    app.dependency_overrides[get_board_service] = lambda: service
    with TestClient(app) as client:
        yield client, service
    app.dependency_overrides.clear()


def create_board(client, members):
    response = client.post('/api/boards/team', json={
        'name': 'Integration Test Team',
        'members': members,
        'egnyteFolderUrl': 'https://example.test/mock-folder',
    })
    assert response.status_code == 201
    return response.json()


@pytest.mark.parametrize('user_id,allowed', [
    ('user-1', True), ('user-2', False), ('user-3', False),
])
def test_created_user_membership_applies_to_list_and_detail(created_client, monkeypatch, user_id, allowed):
    client, _ = created_client
    board = create_board(client, [{'id': 'E001', 'type': 'user'}])
    monkeypatch.setenv('MOCK_USER_ID', user_id)
    summaries = client.get('/api/boards').json()
    assert (board['id'] in {item['id'] for item in summaries}) is allowed
    response = client.get(f"/api/boards/{board['id']}")
    assert response.status_code == (200 if allowed else 404)
    if allowed:
        assert response.json() == board
        summary = next(item for item in summaries if item['id'] == board['id'])
        assert summary == {'id': board['id'], 'name': board['name'], 'type': 'Team', 'openItemCount': 0}


@pytest.mark.parametrize('user_id,allowed', [
    ('user-1', True), ('user-2', False), ('user-3', True),
])
def test_created_group_membership_applies_to_list_and_detail(created_client, monkeypatch, user_id, allowed):
    client, _ = created_client
    board = create_board(client, [{'id': 'G002', 'type': 'group'}])
    monkeypatch.setenv('MOCK_USER_ID', user_id)
    ids = {item['id'] for item in client.get('/api/boards').json()}
    assert (board['id'] in ids) is allowed
    assert client.get(f"/api/boards/{board['id']}").status_code == (200 if allowed else 404)


def test_archived_created_board_is_hidden(created_client):
    client, service = created_client
    board = create_board(client, [{'id': 'E001', 'type': 'user'}])
    service.repository.boards[board['id']]['isArchived'] = True
    assert board['id'] not in {item['id'] for item in client.get('/api/boards').json()}
    assert client.get(f"/api/boards/{board['id']}").status_code == 404


def test_removed_group_access_applies_on_next_request(created_client, monkeypatch):
    client, service = created_client
    board = create_board(client, [{'id': 'G002', 'type': 'group'}])
    assert client.get(f"/api/boards/{board['id']}").status_code == 200
    monkeypatch.setattr(service.groups, 'get_groups', lambda: [])
    assert client.get(f"/api/boards/{board['id']}").status_code == 404
    assert board['id'] not in {item['id'] for item in client.get('/api/boards').json()}


def test_removed_direct_membership_applies_on_next_request(created_client):
    client, service = created_client
    board = create_board(client, [{'id': 'E001', 'type': 'user'}])
    service.repository.boards[board['id']]['members'] = []
    assert client.get(f"/api/boards/{board['id']}").status_code == 404
    assert board['id'] not in {item['id'] for item in client.get('/api/boards').json()}


def test_team_creation_requires_explicit_mock_mode(created_client, monkeypatch):
    client, _ = created_client
    monkeypatch.delenv('APP_MODE')
    assert client.post('/api/boards/team', json={}).status_code == 503


def test_team_creation_rejects_unknown_mock_user(created_client, monkeypatch):
    client, _ = created_client
    monkeypatch.setenv('MOCK_USER_ID', 'unknown')
    assert client.post('/api/boards/team', json={}).status_code == 401


def test_board_detail_and_organizations_routes_are_registered_once():
    for path in ['/api/boards/{board_id}', '/api/organizations']:
        matching = [route for route in app.routes
                    if getattr(route, 'path', None) == path and 'GET' in getattr(route, 'methods', set())]
        assert len(matching) == 1
