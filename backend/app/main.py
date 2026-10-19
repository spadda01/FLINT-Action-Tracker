from app.api.boards import router as boards_router
from fastapi import FastAPI, Header, HTTPException, Depends
from app.services.service_factory import create_services

app = FastAPI(title="FLINT Action Tracker API")
app.include_router(boards_router)

services = create_services()


def check_access(x_mock_role: str = Header(default="viewer")):
    if x_mock_role not in ("viewer", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Access denied"
        )


@app.get("/")
def home():
    return {"message": "FLINT Action Tracker API is running"}


@app.get("/api/projects", dependencies=[Depends(check_access)])
def get_projects():
    return services["projects"].get_projects()


@app.get("/api/employees", dependencies=[Depends(check_access)])
def get_employees():
    return services["employees"].get_employees()


@app.get("/api/groups")
def get_groups():
    return services["groups"].get_groups()


@app.get("/api/organizations")
@app.get("/api/organizations", dependencies=[Depends(check_access)])
def get_organizations():
    return services["organizations"].get_organizations()
