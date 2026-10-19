
from app.adapters.interfaces import NotificationAdapter


class MockNotificationService(NotificationAdapter):
    def __init__(self):
        self.notifications = []
        self.next_id = 1

    def send_notification(self, recipient, message):
        notification = {
            "id": "NOT" + str(self.next_id),
            "recipient": recipient,
            "message": message,
            "status": "mock_sent"
        }

        self.notifications.append(notification)
        self.next_id += 1

        return notification

    def get_notifications(self):
        return self.notifications

