
import pytest

from app.services.service_factory import create_services
from app.adapters.interfaces import (
    ProjectAdapter,
    EmployeeAdapter,
    OrganizationAdapter,
    AttachmentAdapter,
    NotificationAdapter,
)


def test_factory_creates_all_services(monkeypatch):
    monkeypatch.setenv("FLINT_DATA_SOURCE", "mock")

    services = create_services()

    assert set(services.keys()) == {
        "projects",
        "employees",
        "organizations",
        "attachments",
        "notifications",
    }


def test_factory_services_use_interfaces(monkeypatch):
    monkeypatch.setenv("FLINT_DATA_SOURCE", "mock")

    services = create_services()

    assert isinstance(services["projects"], ProjectAdapter)
    assert isinstance(services["employees"], EmployeeAdapter)
    assert isinstance(services["organizations"], OrganizationAdapter)
    assert isinstance(services["attachments"], AttachmentAdapter)
    assert isinstance(services["notifications"], NotificationAdapter)


def test_factory_defaults_to_mock(monkeypatch):
    monkeypatch.delenv("FLINT_DATA_SOURCE", raising=False)

    services = create_services()

    assert len(services["projects"].get_projects()) == 2


def test_factory_rejects_real_connection(monkeypatch):
    monkeypatch.setenv("FLINT_DATA_SOURCE", "real")

    with pytest.raises(ValueError):
        create_services()

