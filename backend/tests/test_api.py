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
