# FLINT-Action-Tracker
Action Tracker for FLINT Design replaces weekly spreadsheets with shared project and department boards. it supports action items, multiple owners, priorities, targets, status tracking, change history, and meeting PDFs. Integrations for Palantir Foundry, Oracle Primavera Cloud, and Microsoft Entra ID.

## Run the integrated application

Use `frontend/` for the shared dashboard, board sidebar, board creation, and action-item workspace. The board workspace uses Max’s `Action_Tracker/` section-table layout with shared backend data and the existing status, target, and priority services. `Action_Tracker/` and `Project_Board/` are standalone reference apps; starting their dev servers does not launch the integrated app.

From the repository root, install and start the mock backend:

```bash
python -m pip install -r backend/requirements.txt
```

Windows Command Prompt:

```bat
set APP_MODE=mock
python -m uvicorn app.main:app --app-dir backend --reload
```

macOS/Linux:

```bash
APP_MODE=mock python -m uvicorn app.main:app --app-dir backend --reload
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. The frontend proxies `/api` to `127.0.0.1:8000`.

Project and team board creation use the same board repository and access checks. Project suggestions come from `/api/projects`; a project board may also be created without a linked project. Mock folder paths are not full web URLs, so enter a valid Egnyte folder URL. To reopen a newly created board, the current mock employee (`user-1` maps to `E001`) must be a selected member or belong to a selected group.

Board and item data use in-memory mock storage and reset on backend restart. Recent-board history is stored per user in the browser. Dashboard manual ordering is not implemented in this integration.

### Board workspace controls

- Click a title, owners, target, hard date, or priority to edit it. Save confirms the change; failed saves keep the draft and offer Retry. Text targets preserve whitespace and line breaks.
- Status and attention controls save to the shared item store. The add-item dialog saves all entered fields; title-only quick entry starts with Open status and Medium priority.
- Drag a row's move handle to another row or an empty section. Keyboard users can open the handle's Move dialog, or use Alt+Up/Down to reorder within a section. Clear search, filters and sorting before moving items so the saved order is unambiguous.
- Add, rename and order sections with the controls beside their headings. Quick entry is available in each section and keeps focus after Enter.
- Filters apply attention/priority filtering and target/priority sorting. Search and filter selections are temporary view state and reset on page refresh.
- Team-board creation uses a keyboard-accessible modal styled from `Project_Board/` with the shared member adapters and save service.
- Status Board and Meeting remain disabled until those views are implemented. The old standalone apps are retained as reference implementations.

Item edits, item ordering and section changes survive browser refresh while the mock backend runs. Mock storage is still in memory and resets on backend restart. The earlier acceptance audit in `docs/testing/` records the specific commit it tested; it is a historical snapshot rather than certification of newer changes.

Validation:

```bash
python -m pytest backend/tests -q
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

### Assigning an organization to an external owner

Story: a curator picks a known company so the same engineer or vendor is spelled consistently across boards.

**User guide.** On any project or team board, tick **External** on an owner (in the Add item dialog or by clicking the Owners cell) and choose the company from the **Organization** dropdown. The company name then appears beside the owner, and board search matches it. Choosing "No organization" is allowed. Unticking External clears the organization. Keyboard: Tab to the dropdown, use the arrow keys or type to choose; Ctrl+Enter saves the inline editor and Escape cancels it.

**Error states.** If the company list cannot be loaded, the dropdown is disabled and shows "Unable to load organizations" with a **Retry** button; the rest of the board keeps working. If a save is rejected (for example the company is no longer in the list), the message is shown, the draft is kept and **Retry save** is offered. A saved organization that is missing from the list is kept and labelled "(not in list)".

**Architecture / runbook.**
- Backend: `CompanyAdapter` (`backend/app/adapters/interfaces.py`) with `MockCompanyService` (`mock_companies.py`) registered as `services["companies"]`. `GET /api/companies` returns `[{id, name}]`. Tests or a future real adapter replace it through the `get_company_adapter` dependency in `backend/app/main.py`.
- Owners gain an optional `organizationId`. Create and update reject unknown IDs, and IDs on non-external owners, with 422. Existing owners without one return `organizationId: null`.
- Frontend: `services/organizationService.ts` loads the list, and `components/OrganizationSelect.tsx` is the shared dropdown used by `BoardItemDialog` and `BoardItemRow`. `BoardWorkspace` loads the list once per board, separately from board data.
- Data: the companies in `mock_companies.py` are fictional placeholders. The real FLINT list will be supplied later as a new `CompanyAdapter`; do not commit real company data or credentials.
- Oracle Primavera Cloud (OPC) has no connection to this feature and receives no writes.

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