
from abc import ABC, abstractmethod


class ProjectAdapter(ABC):
    @abstractmethod
    def get_projects(self):
        pass


class EmployeeAdapter(ABC):
    @abstractmethod
    def get_employees(self):
        pass


class OrganizationAdapter(ABC):
    @abstractmethod
    def get_organizations(self):
        pass


class AttachmentAdapter(ABC):
    @abstractmethod
    def save_attachment(self, filename, content):
        pass

    @abstractmethod
    def get_attachment(self, attachment_id):
        pass


class NotificationAdapter(ABC):
    @abstractmethod
    def send_notification(self, recipient, message):
        pass

