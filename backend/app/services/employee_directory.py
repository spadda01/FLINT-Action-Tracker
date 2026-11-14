MAX_RESULTS = 10


def _summary(employee, project_id):
    return {
        "id": employee["id"],
        "name": employee["name"],
        "department": employee.get("department", ""),
        "active": employee.get("active", True),
        "onProject": project_id is not None and project_id in employee.get("projectIds", []),
    }


class EmployeeDirectory:
    # Reads through the employee adapter only, so the Foundry adapter can
    # replace the mock without changing this code.
    def __init__(self, employees):
        self.employees = employees

    def search(self, query, project_id=None, limit=MAX_RESULTS):
        words = query.casefold().split()
        if not words:
            return []

        # Every typed word must start one of the name's words, so "sa le"
        # finds Sarah Lee and "lee" finds her too.
        matches = []
        for employee in self.employees.get_employees():
            name_words = employee["name"].casefold().split()
            if all(any(part.startswith(word) for part in name_words) for word in words):
                matches.append(_summary(employee, project_id))

        # Active people first, then people allocated to the board's project.
        matches.sort(key=lambda e: (not e["active"], not e["onProject"], e["name"].casefold()))
        return matches[:limit]

    # Used to mark owners on existing items, so inactive people are included.
    def find_by_ids(self, employee_ids, project_id=None):
        wanted = set(employee_ids)
        return [
            _summary(employee, project_id)
            for employee in self.employees.get_employees()
            if employee["id"] in wanted
        ]

    def check_owners(self, owners, current_owners=()):
        """Checks staff owners against the employee records before they're saved.

        Returns the owners with each linked person's name taken from the records.
        Raises OwnerAssignmentError if an owner can't be assigned.
        """
        records = {employee["id"]: employee for employee in self.employees.get_employees()}
        already_owners = {owner.employeeId for owner in current_owners if owner.employeeId}
        seen = set()
        checked = []

        for owner in owners:
            # Free-text owners aren't linked to anyone, so there's nothing to check.
            if owner.employeeId is None:
                checked.append(owner)
                continue

            if owner.isExternal:
                raise OwnerAssignmentError("Only FLINT staff can be linked to an employee record.")

            employee = records.get(owner.employeeId)
            if employee is None:
                raise OwnerAssignmentError("Choose a person from FLINT's employee records.")
            if owner.employeeId in seen:
                raise OwnerAssignmentError(f"{employee['name']} is already an owner of this item.")
            seen.add(owner.employeeId)

            # People who have left stay on items they already own, but can't be added.
            if not employee.get("active", True) and owner.employeeId not in already_owners:
                raise OwnerAssignmentError(f"{employee['name']} is inactive and can't be assigned.")

            checked.append(owner.model_copy(update={"name": employee["name"]}))

        return checked


class OwnerAssignmentError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message
