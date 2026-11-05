"""Additional Jira acceptance probes; run with PYTHONPATH=backend APP_MODE=mock.

This audit intentionally reports unmet criteria instead of treating existing
unit-test success as proof that every sprint requirement is complete.
"""
import json
import os
from fastapi.testclient import TestClient
from app.main import app
from app.api.boards import get_board_service
from app.db.board_repository import InMemoryBoardRepository
from app.services.board_service import BoardService
from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService

os.environ['APP_MODE'] = 'mock'
os.environ['MOCK_USER_ID'] = 'user-1'
service = BoardService(InMemoryBoardRepository(), MockEmployeeService(), MockGroupService())
app.dependency_overrides[get_board_service] = lambda: service
results = []

def record(key, name, passed, actual):
    results.append({'jira': key, 'check': name, 'result': 'PASS' if passed else 'FAIL', 'actual': actual})

with TestClient(app) as c:
    project = c.get('/api/projects').json()[0]
    record('AT-29', 'Project suggestions use mock adapter IDs', project['id'] == 'P001' and project['teamMembers'][0]['id'] == 'E001', project)
    body = {'name': 'Acceptance project', 'projectId': 'P001', 'egnyteFolderUrl': 'https://example.test/project', 'members': [{'id': 'E001', 'type': 'user'}]}
    response = c.post('/api/boards/project', json=body)
    board = response.json()
    record('AT-30', 'Create and reopen project board with confirmed links', response.status_code == 201 and c.get('/api/boards/'+board['id']).json()['projectId'] == 'P001', response.status_code)
    no_project = c.post('/api/boards/project', json={**body, 'projectId': None}).json()
    record('AT-31', 'Create project board without a project link', no_project.get('projectId') is None and 'id' in no_project, no_project)
    paths = list(app.openapi()['paths'])
    board_edit = any(p == '/api/boards/{board_id}' and any(method in app.openapi()['paths'][p] for method in ['put', 'patch']) for p in paths)
    record('AT-30, AT-31', 'Existing board can edit links or link a project later', board_edit, 'No board PATCH/PUT endpoint exists' if not board_edit else 'Endpoint exists')
    section_routes = [p for p in paths if 'section' in p.lower()]
    record('AT-50, AT-104, AT-105', 'Shared section add/rename/reorder persistence API', bool(section_routes), section_routes)
    team = c.post('/api/boards/team', json={**body, 'projectId': None, 'name': 'Acceptance team'}).json()
    record('AT-36', 'Team board reopens without project and with members/folder', c.get('/api/boards/'+team['id']).json() == team and team['type'] == 'Team' and team['projectId'] is None, team)
    group_board = c.post('/api/boards/team', json={**body, 'projectId': None, 'members': [{'id': 'G002','type': 'group'}]}).json()
    record('AT-35', 'Mock Entra group grants access to its member', c.get('/api/boards/'+group_board['id']).status_code == 200, group_board['members'])
    duplicate = c.post('/api/boards/team', json={**body, 'projectId': None, 'members': body['members'] * 2})
    record('AT-35', 'Duplicate members rejected by server', duplicate.status_code == 422, duplicate.status_code)
    invalid = c.post('/api/boards/project', json={**body, 'egnyteFolderUrl':'not a URL'})
    record('AT-28, AT-34', 'Invalid required folder rejected by server', invalid.status_code == 422, invalid.status_code)
    for kind, entry in [('Project', board), ('Team', team)]:
        bid=entry['id']
        item=c.post(f'/api/boards/{bid}/items',json={'title':f'{kind} action'}).json()
        iid=item['id']
        record('AT-9, AT-36', f'{kind} board reads its newly created item', c.get(f'/api/boards/{bid}/items').json()[0]['id']==iid, item)
        record('AT-54, AT-117', f'{kind} quick-add starts Open', item['status']=='Open', item['status'])
        record('AT-54', f'{kind} quick-add starts with Medium priority', item['priority']=='Medium',item['priority'])
        text='  Before job walk\nNext OAC?  '
        text_response=c.patch(f'/api/boards/{bid}/items/{iid}',json={'target':{'type':'text','value':text}})
        stored=c.get(f'/api/boards/{bid}/items').json()[0]
        record('AT-66, AT-152', f'{kind} exact multiline text persists', text_response.status_code==200 and stored['target']=={'type':'text','value':text},stored['target'])
        c.patch(f'/api/boards/{bid}/items/{iid}',json={'target':{'type':'date','value':'2026-11-05'}})
        stored=c.get(f'/api/boards/{bid}/items').json()[0]
        record('AT-153',f'{kind} date type persists',stored['target']=={'type':'date','value':'2026-11-05'},stored['target'])
        invalid_date=c.patch(f'/api/boards/{bid}/items/{iid}',json={'target':{'type':'date','value':'2026-02-30'}})
        record('AT-154',f'{kind} invalid date rejected',invalid_date.status_code==422,invalid_date.status_code)
        history=c.get(f'/api/boards/{bid}/items/{iid}/history').json()
        record('AT-44',f'{kind} target edits record field change history',len(history)>0,history)
        c.patch(f'/api/boards/{bid}/items/{iid}',json={'priority':'High'})
        history=c.get(f'/api/boards/{bid}/items/{iid}/history').json()
        record('AT-44',f'{kind} priority edits record field change history',len(history)>0,history)
        for status in ['Open','Not Started','In Progress','Scheduled','Outstanding','Complete']:
            changed=c.patch(f'/api/boards/{bid}/items/{iid}/status',json={'status':status})
            record('AT-68, AT-158',f'{kind} accepts {status} status',changed.status_code==200,changed.status_code)
        history=c.get(f'/api/boards/{bid}/items/{iid}/history').json()
        record('AT-159',f'{kind} status history records actor/time/old/new',len(history)>0 and all(all(k in h for k in ['actorId','changedAt','oldStatus','newStatus']) for h in history),len(history))
        changed=c.patch(f'/api/boards/{bid}/items/{iid}/priority',json={'priority':'Low'})
        record('AT-165',f'{kind} priority endpoint updates shared item',changed.status_code==200 and c.get(f'/api/boards/{bid}/items').json()[0]['priority']=='Low',changed.status_code)
        summaries=c.get('/api/boards').json()
        count=next(b['openItemCount'] for b in summaries if b['id']==bid)
        # Complete items shouldn't contribute; reopen to check the live open count.
        c.patch(f'/api/boards/{bid}/items/{iid}/status',json={'status':'Open'})
        summaries=c.get('/api/boards').json()
        count=next(b['openItemCount'] for b in summaries if b['id']==bid)
        record('AT-39, AT-40',f'{kind} dashboard open-item count reflects added open item',count==1,count)
        os.environ['MOCK_USER_ID']='user-2'
        record('AT-40, AT-44',f'{kind} nonmember cannot read or edit',c.get(f'/api/boards/{bid}/items').status_code==404 and c.patch(f'/api/boards/{bid}/items/{iid}',json={'priority':'High'}).status_code==404,'404 for read and edit')
        os.environ['MOCK_USER_ID']='user-1'
    c.patch(f"/api/boards/{board['id']}/items/1/status",json={'status':'Open'})
    before=c.get(f"/api/boards/{board['id']}/items").json()[0]['status']
    rejected=c.patch(f"/api/boards/{board['id']}/items/1",json={'status':'Complete','priority':'Invalid'})
    after=c.get(f"/api/boards/{board['id']}/items").json()[0]['status']
    record('AT-44', 'Rejected combined edit leaves item unchanged',rejected.status_code==422 and before==after,{'http':rejected.status_code,'before':before,'after':after})
app.dependency_overrides.clear()
print(json.dumps({'total':len(results),'passed':sum(r['result']=='PASS' for r in results),'failed':sum(r['result']=='FAIL' for r in results),'checks':results},indent=2))
