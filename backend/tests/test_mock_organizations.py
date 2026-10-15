
from app.mock_organizations import MockOrganizationService
from app.mock_employees import MockEmployeeService


def test_get_organizations():
    service = MockOrganizationService()
    organizations = service.get_organizations()

    assert len(organizations) == 3
    assert organizations[0]["name"] == "Flint Engineering"


def test_organization_has_department():
    service = MockOrganizationService()
    organizations = service.get_organizations()

    for organization in organizations:
        assert "department" in organization
        assert organization["department"]


def test_organization_has_employee_ids():
    service = MockOrganizationService()
    organizations = service.get_organizations()

    for organization in organizations:
        assert isinstance(organization["employeeIds"], list)


def test_organization_employees_exist():
    organizations = MockOrganizationService().get_organizations()
    employees = MockEmployeeService().get_employees()

    employee_ids = {employee["id"] for employee in employees}

    for organization in organizations:
        for employee_id in organization["employeeIds"]:
            assert employee_id in employee_ids

