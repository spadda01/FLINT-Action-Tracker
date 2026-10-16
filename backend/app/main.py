from fastapi import FastAPI
from app.services.service_factory import create_services

app = FastAPI(title="FLINT Action Tracker API")

services = create_services()


@app.get("/")
def home():
    return {"message": "FLINT Action Tracker API is running"}


@app.get("/api/projects")
def get_projects():
    return services["projects"].get_projects()


@app.get("/api/employees")
def get_employees():
    return services["employees"].get_employees()


@app.get("/api/organizations")
def get_organizations():
    return services["organizations"].get_organizations()