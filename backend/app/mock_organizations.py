from app.interfaces import OrganizationAdapter
class MockOrganizationService(OrganizationAdapter):
    def get_organizations(self):
        return [
            {
                "id": "ORG001",
                "name": "Flint Engineering",
                "department": "Engineering",
                "employeeIds": ["E001"]
            },
            {
                "id": "ORG002",
                "name": "Flint Design",
                "department": "Design",
                "employeeIds": ["E002"]
            },
            {
                "id": "ORG003",
                "name": "Flint Construction",
                "department": "Construction",
                "employeeIds": ["E003"]
            }
        ]


