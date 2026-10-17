from datetime import datetime, timezone
from urllib.parse import urlparse

MAX_NAME_LENGTH = 200


# Carries every failed field at once so the user can fix them all in one pass.
class BoardValidationError(Exception):
    def __init__(self, errors):
        super().__init__("Board information is not valid")
        self.errors = errors


class BoardService:
    def __init__(self, repository, employees, groups):
        self.repository = repository
        self.employees = employees
        self.groups = groups

    def create_team_board(self, data):
        errors = {}

        name = data.name.strip()
        if not name:
            errors["name"] = "Board name is required."
        elif len(name) > MAX_NAME_LENGTH:
            errors["name"] = f"Board name must be {MAX_NAME_LENGTH} characters or fewer."

        members, member_error = self._resolve_members(data.members)
        if member_error:
            errors["members"] = member_error

        egnyte_url = data.egnyteFolderUrl.strip()
        if not egnyte_url:
            errors["egnyteFolderUrl"] = "Egnyte folder link is required."
        elif not _is_web_link(egnyte_url):
            errors["egnyteFolderUrl"] = "Egnyte folder link must be a full http or https link."

        # Team boards are the "no project" boards; project boards are created elsewhere.
        if data.projectId is not None:
            errors["projectId"] = "A team board cannot be linked to a project."

        if errors:
            raise BoardValidationError(errors)

        return self.repository.save_board({
            "name": name,
            "type": "Team",
            "projectId": None,
            "members": members,
            "egnyteFolderUrl": egnyte_url,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    def get_board(self, board_id):
        return self.repository.get_board(board_id)

    # Checks each selection against the user and group adapters and returns
    # members with their display names, or the first problem found.
    def _resolve_members(self, selected):
        if not selected:
            return [], "Add at least one member or group."

        known = {
            "user": {e["id"]: e["name"] for e in self.employees.get_employees()},
            "group": {g["id"]: g["name"] for g in self.groups.get_groups()},
        }

        members = []
        seen = set()
        for member in selected:
            if member.type not in known:
                return [], "Each member must be a user or a group."

            name = known[member.type].get(member.id)
            if name is None:
                return [], f"Unknown {member.type}: {member.id or '(blank)'}."

            key = (member.type, member.id)
            if key in seen:
                return [], f"{name} was selected more than once."
            seen.add(key)

            members.append({"id": member.id, "type": member.type, "name": name})

        return members, None


def _is_web_link(value):
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)
