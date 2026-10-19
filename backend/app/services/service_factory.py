
from app.config import get_data_source
from app.adapters.mock_projects import MockProjectService
from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.adapters.mock_organizations import MockOrganizationService
from app.adapters.mock_attachments import MockAttachmentService
from app.adapters.mock_notifications import MockNotificationService


def create_services():
    source = get_data_source()

    if source == "mock":
        return {
            "projects": MockProjectService(),
            "employees": MockEmployeeService(),
            "groups": MockGroupService(),
            "organizations": MockOrganizationService(),
            "attachments": MockAttachmentService(),
            "notifications": MockNotificationService()
        }

    raise ValueError("Unsupported data source")

