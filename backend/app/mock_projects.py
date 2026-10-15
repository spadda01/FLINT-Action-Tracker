from app.interfaces import ProjectAdapter
class MockProjectService(ProjectAdapter):
    def get_projects(self):
        return [
            {
                "id": "P001",
                "name": "Sample Project",
                "teamMembers": [
                    {"id": "E001", "name": "John Smith"},
                    {"id": "E002", "name": "Sarah Lee"}
                ],
                "egnyteFolder": "/Projects/SampleProject"
            },
            {
                "id": "P002",
                "name": "Office Renovation",
                "teamMembers": [
                    {"id": "E003", "name": "Mike Chen"}
                ],
                "egnyteFolder": "/Projects/OfficeRenovation"
            }
        ]

