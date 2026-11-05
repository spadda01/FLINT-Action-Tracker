from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.boards import get_board_service
from app.api.item_status import get_status_service
from app.db.item_status_repository import InMemoryActionItemStore, InMemoryStatusHistoryStore
from app.services.status_service import StatusService
from app.adapters.mock_action_items import MOCK_ACTION_ITEMS
from app.adapters.board_sections import MOCK_SECTIONS
from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.db.board_repository import InMemoryBoardRepository
from app.services.board_service import BoardService


@pytest.fixture
def workspace(monkeypatch):
    monkeypatch.setenv('APP_MODE', 'mock')
    monkeypatch.setenv('MOCK_USER_ID', 'user-1')
    original_items = deepcopy(MOCK_ACTION_ITEMS)
    original_sections = deepcopy(MOCK_SECTIONS)
    MOCK_SECTIONS.clear()
    service = BoardService(InMemoryBoardRepository(), MockEmployeeService(), MockGroupService())
    app.dependency_overrides[get_board_service] = lambda: service
    status_service = StatusService(InMemoryActionItemStore(), InMemoryStatusHistoryStore())
    app.dependency_overrides[get_status_service] = lambda: status_service
    with TestClient(app) as client:
        boards = []
        for kind in ['project', 'team']:
            board = client.post(f'/api/boards/{kind}', json={
                'name': kind, 'members': [{'id': 'E001', 'type': 'user'}],
                'egnyteFolderUrl': 'https://example.test/folder',
            }).json()
            boards.append(board['id'])
        yield client, boards
    app.dependency_overrides.clear()
    MOCK_ACTION_ITEMS.clear(); MOCK_ACTION_ITEMS.update(original_items)
    MOCK_SECTIONS.clear(); MOCK_SECTIONS.update(original_sections)


@pytest.mark.parametrize('index', [0, 1])
def test_full_dialog_fields_and_inline_updates_survive_reads(workspace, index):
    client, boards = workspace
    base = f'/api/boards/{boards[index]}'
    created = client.post(base+'/items', json={
        'title': 'Meeting action', 'section': 'Procurement',
        'owners': [{'name':'Jim', 'isExternal':True}],
        'target': {'type':'text','value':'  Before job walk\nASAP  '},
        'hardDate': '2026-11-07', 'priority':'High','status':'Open','attention':True,
    })
    assert created.status_code == 201
    item = created.json()
    assert client.get(base+'/items').json() == [item]
    changed = client.patch(base+f"/items/{item['id']}", json={
        'title':'Updated action', 'owners':[{'name':'Austin','isExternal':False}],
        'target':{'type':'date','value':'2026-11-06'}, 'hardDate':None,'attention':False,
    })
    assert changed.status_code == 200
    saved = client.get(base+'/items').json()[0]
    assert saved['title'] == 'Updated action'
    assert saved['owners'] == [{'name':'Austin','isExternal':False}]
    assert saved['target'] == {'type':'date','value':'2026-11-06'}
    assert saved['hardDate'] is None and saved['attention'] is False


@pytest.mark.parametrize('index', [0, 1])
def test_sections_and_item_moves_keep_order_and_empty_sections(workspace, index):
    client, boards = workspace
    base=f'/api/boards/{boards[index]}'
    first=client.get(base+'/sections').json()[0]
    second=client.post(base+'/sections',json={'name':'Coordination'}).json()
    items=[client.post(base+'/items',json={'title':title}).json() for title in ['A','B','C']]
    a,b,c=[item['id'] for item in items]
    moved=client.post(base+f'/items/{c}/move',json={'sectionId':first['id'],'beforeItemId':a})
    assert [i['id'] for i in moved.json()] == [c,a,b]
    for iid in [c,a,b]:
        assert client.post(base+f'/items/{iid}/move',json={'sectionId':second['id']}).status_code == 200
    assert client.get(base+'/sections').json() == [first,second]
    assert [item['id'] for item in client.get(base+'/items').json()] == [c,a,b]
    renamed=client.patch(base+f"/sections/{second['id']}",json={'name':'Follow-ups'})
    assert renamed.status_code == 200
    assert {i['section'] for i in client.get(base+'/items').json()} == {'Follow-ups'}
    ordered=client.put(base+'/sections/order',json={'sectionIds':[second['id'],first['id']]})
    assert ordered.status_code == 200
    assert client.get(base+'/sections').json()[0]['name'] == 'Follow-ups'
    assert len(client.get(base+'/items').json()) == len({i['id'] for i in client.get(base+'/items').json()}) == 3


def test_invalid_moves_and_section_orders_do_not_change_state(workspace):
    client, boards=workspace
    base=f'/api/boards/{boards[0]}'
    sections=client.get(base+'/sections').json()
    a=client.post(base+'/items',json={'title':'A'}).json()
    b=client.post(base+'/items',json={'title':'B','section':'Other'}).json()
    original=client.get(base+'/items').json()
    for data in [ {'sectionId':'missing'}, {'sectionId':sections[0]['id'],'beforeItemId':999}, {'sectionId':sections[0]['id'],'beforeItemId':b['id']} ]:
        assert client.post(base+f"/items/{a['id']}/move",json=data).status_code == 422
        assert client.get(base+'/items').json() == original
    assert client.put(base+'/sections/order',json={'sectionIds':[]}).status_code == 422
    assert client.post(base+'/sections',json={'name':'  General  '}).status_code == 422
    assert client.post(base+'/sections',json={'name':'  '}).status_code == 422


def test_rejected_combined_patch_is_atomic_and_invalid_creation_rejected(workspace):
    client, boards=workspace
    base=f'/api/boards/{boards[0]}'
    original=client.post(base+'/items',json={'title':'A'}).json()
    assert original['status'] == 'Open'
    for data in [{'status':'Complete','priority':'Invalid'}, {'status':'Complete','hardDate':'2026-02-30'}, {'attention':None}, {'title':'  '}]:
        assert client.patch(base+f"/items/{original['id']}",json=data).status_code == 422
        assert client.get(base+'/items').json()[0] == original
    assert client.get(base+f"/items/{original['id']}/history").json() == []
    for data in [{'title':'A','priority':'Invalid'},{'title':'A','status':'Invalid'},{'title':'A','hardDate':'tomorrow'}]:
        assert client.post(base+'/items',json=data).status_code == 422
    assert len(client.get(base+'/items').json()) == 1


def test_live_open_counts_track_status_and_new_items(workspace):
    client, boards=workspace
    base=f'/api/boards/{boards[0]}'
    assert client.get(base).json()['openItemCount'] == 0
    item=client.post(base+'/items',json={'title':'Count me'}).json()
    assert client.get(base).json()['openItemCount'] == 1
    assert next(b for b in client.get('/api/boards').json() if b['id']==boards[0])['openItemCount'] == 1
    client.patch(base+f"/items/{item['id']}/status",json={'status':'Complete'})
    assert client.get(base).json()['openItemCount'] == 0


def test_workspace_changes_require_membership_and_cannot_cross_boards(workspace, monkeypatch):
    client, boards=workspace
    base=f'/api/boards/{boards[0]}'
    item=client.post(base+'/items',json={'title':'A'}).json()
    foreign=client.get(f'/api/boards/{boards[1]}/sections').json()[0]
    assert client.post(base+f"/items/{item['id']}/move",json={'sectionId':foreign['id']}).status_code == 422
    monkeypatch.setenv('MOCK_USER_ID','user-2')
    for method,path,data in [('GET','/sections',None),('POST','/sections',{'name':'Hidden'}),('PUT','/sections/order',{'sectionIds':[]}),('POST',f"/items/{item['id']}/move",{'sectionId':foreign['id']}),('PATCH',f"/items/{item['id']}",{'attention':True})]:
        assert client.request(method,base+path,json=data).status_code == 404


def test_creation_and_inline_priority_use_same_configured_levels(workspace, monkeypatch):
    from app.api.priorities import priority_service
    client, boards = workspace
    monkeypatch.setattr(priority_service, 'levels', [{'name':'Urgent','rank':0}, {'name':'Medium','rank':1}])
    assert client.get('/api/priorities').json()[0]['name'] == 'Urgent'
    base=f'/api/boards/{boards[0]}'
    item=client.post(base+'/items',json={'title':'Configured item','priority':'Urgent'})
    assert item.status_code == 201
    updated=client.patch(base+f"/items/{item.json()['id']}",json={'priority':'Medium'})
    assert updated.status_code == 200
    assert updated.json()['priority'] == 'Medium'
