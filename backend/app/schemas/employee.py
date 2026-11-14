from pydantic import BaseModel


class EmployeeSummary(BaseModel):
    id: str
    name: str
    department: str
    active: bool
    # True when the employee is allocated to the board's linked project.
    onProject: bool
