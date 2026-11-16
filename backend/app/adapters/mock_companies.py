from app.adapters.interfaces import CompanyAdapter

# Fictional placeholder companies. Replace with the real FLINT list later
# by adding another CompanyAdapter implementation; no FLINT data belongs here.
MOCK_COMPANIES = [
    {"id": "CO001", "name": "Example Structural Engineering"},
    {"id": "CO002", "name": "Sample Mechanical Contractors"},
    {"id": "CO003", "name": "Placeholder Electrical Supply"},
    {"id": "CO004", "name": "Demo Civil Consultants"},
]


class MockCompanyService(CompanyAdapter):
    def get_companies(self):
        return [dict(company) for company in MOCK_COMPANIES]
