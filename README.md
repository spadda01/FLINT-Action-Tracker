# FLINT-Action-Tracker
Action Tracker for FLINT Design replaces weekly spreadsheets with shared project and department boards. it supports action items, multiple owners, priorities, targets, status tracking, change history, and meeting PDFs. Integrations for Palantir Foundry, Oracle Primavera Cloud, and Microsoft Entra ID.

### maxgrot branch
- Project Board creation
- Allowing for "no project" specifically

#### AT-34 subtask AT-35
- The Team Create board is now visible and contains empty fields to be edited by the user.
#### AT-34 subtask AT-36
- The Team Create board is now functional with drop downs, multiple field entries, and individual text entries.

### sorey branch
- Set a target as text or a date

#### AT-66 subtask AT-152
- On an accessible board, action-item targets can be entered as text or selected with a native calendar date input.
- Target changes are saved through the configured mock API. Dates are validated as calendar dates. Text is saved and displayed exactly as entered.

#### AT-66 subtask AT-153
- Edits preserve the target's text or date type and value.
- **Sort by target** places dated targets first in chronological order, followed by text targets.

#### AT-66 subtask AT-154
- The target table provides loading, empty, retry, invalid-input, and save-failure states. Its native controls and sort/save actions are keyboard accessible.
- Automated tests use mock data and cover text/date editing, exact text preservation, sorting, denied access, invalid dates, load failures, save failures, and connection failures.
- Demo checklist:
  1. Open an authorized board and wait for its action items to load.
  2. Enter text with leading/trailing spaces or a line break, save it, and verify it remains unchanged.
  3. Select and save a calendar date.
  4. Sort by target; verify dates appear first chronologically and text targets follow.
  5. Use Tab and Enter to operate the sort and save controls. Automated tests cover the relevant error and empty states.