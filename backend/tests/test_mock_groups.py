from app.adapters.interfaces import GroupAdapter
from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService


def test_group_implements_interface():
    assert isinstance(MockGroupService(), GroupAdapter)


def test_get_groups():
    groups = MockGroupService().get_groups()

    assert len(groups) == 3
    assert groups[0]["id"] == "G001"
    assert groups[0]["name"] == "A&E Department"


def test_group_members_exist():
    groups = MockGroupService().get_groups()
    employee_ids = {e["id"] for e in MockEmployeeService().get_employees()}

    for group in groups:
        for member_id in group["memberIds"]:
            assert member_id in employee_ids
