from app.adapters.interfaces import GroupAdapter


# Stands in for Entra ID groups until the dev tenant is connected.
class MockGroupService(GroupAdapter):
    def get_groups(self):
        return [
            {
                "id": "G001",
                "name": "A&E Department",
                "memberIds": ["E002"]
            },
            {
                "id": "G002",
                "name": "Preconstruction",
                "memberIds": ["E001", "E003"]
            },
            {
                "id": "G003",
                "name": "IT",
                "memberIds": ["E001"]
            }
        ]
