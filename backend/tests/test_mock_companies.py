from app.adapters.interfaces import CompanyAdapter
from app.adapters.mock_companies import MockCompanyService


def test_mock_company_service_implements_adapter():
    assert isinstance(MockCompanyService(), CompanyAdapter)


def test_companies_have_unique_ids_and_names():
    companies = MockCompanyService().get_companies()
    assert companies
    assert len({c["id"] for c in companies}) == len(companies)
    assert all(c["name"].strip() for c in companies)


def test_callers_cannot_mutate_the_source_list():
    service = MockCompanyService()
    service.get_companies()[0]["name"] = "Changed"
    assert service.get_companies()[0]["name"] != "Changed"
