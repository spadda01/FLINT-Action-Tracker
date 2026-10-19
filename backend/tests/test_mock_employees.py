
from app.adapters.mock_employees import MockEmployeeService


def test_get_employees():
    service = MockEmployeeService()
    employees = service.get_employees()

    assert len(employees) == 3
    assert employees[0]["name"] == "John Smith"


def test_employee_has_department():
    service = MockEmployeeService()
    employees = service.get_employees()

    for employee in employees:
        assert "department" in employee
        assert employee["department"]


def test_employee_has_project_ids():
    service = MockEmployeeService()
    employees = service.get_employees()

    for employee in employees:
        assert "projectIds" in employee
        assert isinstance(employee["projectIds"], list)


def test_employee_project_matches_mock_projects():
    service = MockEmployeeService()
    employees = service.get_employees()

    from app.adapters.mock_projects import MockProjectService

    projects = MockProjectService().get_projects()
    project_ids = {project["id"] for project in projects}

    for employee in employees:
        for project_id in employee["projectIds"]:
            assert project_id in project_ids

