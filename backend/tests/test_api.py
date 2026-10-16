from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_home():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "FLINT Action Tracker API is running"


def test_get_projects():
    response = client.get("/api/projects")
    assert response.status_code == 200

    projects = response.json()
    assert len(projects) == 2
    assert projects[0]["id"] == "P001"
    assert projects[1]["id"] == "P002"

def test_get_employees():
    response = client.get("/api/employees")
    assert response.status_code == 200

    employees = response.json()
    assert len(employees) == 3
    assert employees[0]["id"] == "E001"


def test_get_organizations():
    response = client.get("/api/organizations")
    assert response.status_code == 200

    organizations = response.json()
    assert len(organizations) == 3
    assert organizations[0]["id"] == "ORG001"