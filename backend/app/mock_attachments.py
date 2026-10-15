
from app.interfaces import AttachmentAdapter


class MockAttachmentService(AttachmentAdapter):
    def __init__(self):
        self.attachments = {}
        self.next_id = 1

    def save_attachment(self, filename, content):
        attachment_id = "ATT" + str(self.next_id)
        self.next_id += 1

        self.attachments[attachment_id] = {
            "id": attachment_id,
            "filename": filename,
            "content": content
        }

        return attachment_id

    def get_attachment(self, attachment_id):
        return self.attachments.get(attachment_id)

