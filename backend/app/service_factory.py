
from app.config import get_data_source
from app.mock_projects import MockProjectService
from app.mock_employees import MockEmployeeService
from app.mock_organizations import MockOrganizationService
from app.mock_attachments import MockAttachmentService
from app.mock_notifications import MockNotificationService


def create_services():
    source = get_data_source()

    if source == "mock":
        return {
            "projects": MockProjectService(),
            "employees": MockEmployeeService(),
            "organizations": MockOrganizationService(),
            "attachments": MockAttachmentService(),
            "notifications": MockNotificationService()
        }

    raise ValueError("Unsupported data source")

