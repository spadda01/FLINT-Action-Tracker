
from app.adapters.mock_attachments import MockAttachmentService
from app.adapters.interfaces import AttachmentAdapter


def test_attachment_implements_interface():
    service = MockAttachmentService()
    assert isinstance(service, AttachmentAdapter)


def test_save_attachment():
    service = MockAttachmentService()

    attachment_id = service.save_attachment(
        "sample.txt", "Hello Flint OS"
    )

    assert attachment_id == "ATT1"


def test_get_attachment():
    service = MockAttachmentService()

    attachment_id = service.save_attachment(
        "sample.txt", "Hello Flint OS"
    )

    attachment = service.get_attachment(attachment_id)

    assert attachment["filename"] == "sample.txt"
    assert attachment["content"] == "Hello Flint OS"


def test_attachment_not_found():
    service = MockAttachmentService()

    result = service.get_attachment("ATT999")

    assert result is None


def test_multiple_attachments():
    service = MockAttachmentService()

    first = service.save_attachment("first.txt", "First")
    second = service.save_attachment("second.txt", "Second")

    assert first != second
    assert service.get_attachment(first)["content"] == "First"
    assert service.get_attachment(second)["content"] == "Second"

import pytest


def test_save_attachment_failure():
    service = MockAttachmentService()

    with pytest.raises(ValueError, match="Filename is required"):
        service.save_attachment("", "test content")

    assert service.attachments == {}
    