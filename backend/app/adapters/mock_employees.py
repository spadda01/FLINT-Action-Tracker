from app.adapters.interfaces import EmployeeAdapter
class MockEmployeeService(EmployeeAdapter):
    def get_employees(self):
        return [
            {
                "id": "E001",
                "name": "John Smith",
                "department": "Engineering",
                "projectIds": ["P001"]
            },
            {
                "id": "E002",
                "name": "Sarah Lee",
                "department": "Design",
                "projectIds": ["P001"]
            },
            {
                "id": "E003",
                "name": "Mike Chen",
                "department": "Construction",
                "projectIds": ["P002"]
            }
        ]


