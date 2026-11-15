from app.adapters.interfaces import EmployeeAdapter
class MockEmployeeService(EmployeeAdapter):
    # Stands in for FLINT's employee records until the Foundry adapter exists.
    # "active" is False for people who have left; they stay on old items but
    # can't be picked as a new owner.
    def get_employees(self):
        return [
            {
                "id": "E001",
                "name": "John Smith",
                "department": "Engineering",
                "projectIds": ["P001"],
                "active": True
            },
            {
                "id": "E002",
                "name": "Sarah Lee",
                "department": "Design",
                "projectIds": ["P001"],
                "active": True
            },
            {
                "id": "E003",
                "name": "Mike Chen",
                "department": "Construction",
                "projectIds": ["P002"],
                "active": True
            },
            {
                "id": "E004",
                "name": "Austin Rivera",
                "department": "Construction",
                "projectIds": ["P001"],
                "active": True
            },
            {
                "id": "E005",
                "name": "James Ortiz",
                "department": "Construction",
                "projectIds": ["P001", "P002"],
                "active": True
            },
            {
                "id": "E006",
                "name": "Maranda Lopez",
                "department": "Design",
                "projectIds": ["P002"],
                "active": True
            },
            {
                "id": "E007",
                "name": "Kristy Nguyen",
                "department": "Engineering",
                "projectIds": [],
                "active": True
            },
            {
                "id": "E008",
                "name": "Dana Whitfield",
                "department": "Construction",
                "projectIds": ["P001"],
                "active": False
            }
        ]
