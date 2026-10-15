
from app.mock_notifications import MockNotificationService
from app.interfaces import NotificationAdapter


def test_notification_implements_interface():
    service = MockNotificationService()
    assert isinstance(service, NotificationAdapter)


def test_send_notification():
    service = MockNotificationService()

    result = service.send_notification(
        "john@example.com",
        "Your project was updated"
    )

    assert result["id"] == "NOT1"
    assert result["recipient"] == "john@example.com"
    assert result["status"] == "mock_sent"


def test_get_notifications():
    service = MockNotificationService()

    service.send_notification(
        "john@example.com",
        "New task assigned"
    )

    notifications = service.get_notifications()

    assert len(notifications) == 1
    assert notifications[0]["message"] == "New task assigned"


def test_multiple_notifications():
    service = MockNotificationService()

    first = service.send_notification("john@example.com", "First")
    second = service.send_notification("sarah@example.com", "Second")

    assert first["id"] != second["id"]
    assert len(service.get_notifications()) == 2

