
from app.adapters.mock_projects import MockProjectService


def test_get_projects():
    service = MockProjectService()
    projects = service.get_projects()

    assert len(projects) == 2
    assert projects[0]["id"] == "P001"
    assert projects[0]["name"] == "Sample Project"
    assert len(projects[0]["teamMembers"]) == 2


def test_project_has_egnyte_folder():
    service = MockProjectService()
    projects = service.get_projects()

    for project in projects:
        assert "egnyteFolder" in project
        assert project["egnyteFolder"]


def test_project_has_team_members():
    service = MockProjectService()
    projects = service.get_projects()

    for project in projects:
        assert "teamMembers" in project
        assert len(project["teamMembers"]) > 0


