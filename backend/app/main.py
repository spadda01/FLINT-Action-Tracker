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
