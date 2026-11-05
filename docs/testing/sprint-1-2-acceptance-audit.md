# Sprint 1 and 2 acceptance audit — November 3, 2026

**Result: integration is functional, but Sprints 1 and 2 do not fully meet the supplied Jira acceptance criteria. Keep PR #16 in draft while the confirmed gaps are reviewed.**

Scope: all **47 Jira rows** in the supplied `Jira.csv` assigned to AT Sprint 1 (20 issues) or AT Sprint 2 (27 issues). Jira marks all 47 Done. Reviewed the actual descriptions, not older task-number summaries. Tested the PR #16 integration implementation at `a70a28fbf1f3a27d0f6f05bff73fb3a9ad429332`, based on main `3380609f76b7b3ebb1f932d12c507d173447faae`. This audit adds evidence only; it does not fix the newly found product gaps or change main.

## Evidence and limits

- Existing regression suites rerun: **170 backend tests passed**, **122 frontend tests passed**. Backend emits one dependency deprecation warning.
- Existing final integration checks: ESLint, TypeScript/Vite production build, diff whitespace validation and headless desktop/mobile smoke checks passed.
- Additional Jira API probes: **46 checks — 35 pass, 11 fail**.
- Additional real-browser probes against local Vite/FastAPI: **13 checks — 4 pass, 9 fail**.
- Combined extra probes: **59 checks — 39 pass, 20 fail**. Several failures repeat the same defect across Project and Team boards; these are not 20 independent bugs. These are targeted probes, not an exhaustive test of every possible input.
- All 47 rows have traceability below. “Pass” means the stated implementation behavior was supported by executed tests or inspected mock contracts; it is not release acceptance. “Partial” identifies known missing criteria or unverified portions. “Fail” identifies required behavior that is absent or demonstrably incorrect.
- Tests use synthetic mock identities and data. No live Foundry, Entra, Egnyte or OPC integration was exercised. Backend restart persistence is not claimed; current adapters use memory.
- Exact Figma fidelity and reproducing the client's supplied tracker cannot be signed off without those current reference artifacts. Live roles, Friday demonstration, PR review, and Jira-to-PR links require team confirmation. Optional OPC adapter is stretch scope and is not counted as a blocker for core AT-91.

## Confirmed issues and reproduction

| Finding | Jira | Reproduce | Expected | Actual |
|---|---|---|---|---|
| Missing section management | AT-50, AT-104–106 | Open either board type; look for section add/rename/reorder controls and section API | Save names/order and retain item membership after reload | No controls or section persistence routes/model |
| Empty section has no label | AT-43, AT-50 | POST an item with `section: ""`, then open its table | Item under a default heading | Empty section heading |
| Wrong quick-add status | AT-54, AT-117 | Quick-add a title-only item on either board type | Open status | Not Started |
| Quick-add section/focus gap | AT-116 | Open a board with two sections; type in quick entry and press Enter | Entry within chosen section; input stays ready for next action | One global row, defaults General; focus moves to BODY |
| Incorrect live open counts | AT-39, AT-40 | Create accessible board; add an item; set status Open; return to dashboard | Open-item count 1 | Count remains 0 |
| Existing project metadata cannot be changed | AT-30, AT-31 | Create board with no project and reopen; look for linking/name/folder controls | Link later; change name/folder without losing items | No board update API or UI; also no project-list Retry control |
| Missing folder default | AT-27, AT-28 | Select mock P001 | Project folder supplied as editable default | Mock provides `/Projects/SampleProject`; form leaves required full-URL field blank |
| Non-status history absent | AT-44 | Save target and priority; GET item history | Actor/time/field/old/new changes for each edit | History remains empty until a status changes |
| Failed status falsely announces success | AT-44, AT-160 | Intercept item `/status` PATCH with HTTP 500; choose Complete | Old value, failure and chooser Retry, no success announcement | Old pill remains; page error appears; hidden announcement says “Status changed to Complete.”; no chooser Retry |
| Failed priority drops edit | AT-44, AT-166 | Intercept item PATCH with HTTP 500; choose Low in inline priority | Preserve chosen draft and clear retry action | Editor closes, old High stays, generic failure text; no explicit Retry |
| Inline priority ignores configuration | AT-164, AT-165 | Supply priorities API list including Urgent; edit table priority | Editor displays configured levels | Choices remain High/Medium/Low; secondary panel consumes API levels |
| Rejected combined update partially saves | AT-44 (API integrity) | PATCH item with `{ "status": "Complete", "priority": "Invalid" }` | Rejected request leaves item unchanged | HTTP 422 but status already changed from Open to Complete and history written |

The last issue uses the public general item PATCH endpoint directly. Current single-field table controls do not submit that combined payload, but the API is exposed and should validate the whole request before mutating state.

## Jira traceability

### AT Sprint 1

| Jira | Issue | Verdict | Evidence / remaining criteria |
|---|---|---|---|
| AT-27 | As a board admin, I want to create a board linked to a FLINT project, so that its name and team come from project data. | Partial | Project name/team suggestions and save work. Folder default is blank for supplied mock paths; later linking/editing is absent. |
| AT-28 | Build the project board creation form | Partial | Required controls, editable name/link, keyboard form and validation work. Selected mock project folder is discarded rather than prefilled. |
| AT-29 | Load project choices and team owner suggestions through mocked adapters | Pass | API-backed mock choices and team suggestions work; changing P001 to P002 replaces the previous team. |
| AT-30 | Save the project board with its name, project link, and Egnyte folder link | Partial | Saved name/project/folder reopen through API; no existing-board name/folder edit UI or update API. |
| AT-31 | Allow board creation when project data fails and linking the project later | Partial | Manual creation remains available during project load failure. Project-list retry and linking an existing board later are absent. |
| AT-32 | Test project board creation, defaults, editable links, and project data failures | Partial | Creation/defaults/failure preservation have automated coverage; later-link criteria fail because the feature is absent. |
| AT-33 | As a department lead, I want a board with no project attached, so that my team can track non-project work. | Pass | Mock team creation with required members/folder and shared current item workspace works. Future-sprint views are outside this result. |
| AT-34 | Build the team board creation form with name, members, and Egnyte folder link | Pass | Name, folder, user/group selection, required validation and keyboard controls are covered by frontend/backend tests. |
| AT-35 | Support selecting individual users and Entra groups as team board members | Partial | Users/groups, removal, duplicate rejection and group-based access work. Dedicated member search and additional-option load failure were not demonstrated; selection is a native dropdown. |
| AT-36 | Save team boards without a project link using the shared board features | Pass | Team projectId stays null; saved details reopen; shared item/status/priority store and server validation work in mocks. |
| AT-37 | Test team board creation, membership, and shared sections, items, and views | Partial | Core creation/access/error tests pass. Search-specific member selection criteria remain unverified. |
| AT-38 | As a contributor, I want a list of boards I can open, split into Project and Team, so that I reach the right one fast. | Partial | Separated lists, access/archive exclusion, name search and recency work. Open-item counts become incorrect after item changes. |
| AT-39 | Build the Project and Team board lists with names, types, and open item counts | Partial | List structure, readable names, keyboard controls and empty states pass. Newly created board count stays 0 after adding an open item. |
| AT-40 | Load accessible boards and hide archived boards by default | Partial | Server access/archive checks and loading/retry pass. Reported counts are stored sample/default values, not current item counts. |
| AT-41 | Implement board search, recently opened ordering, and navigation | Pass | Case-insensitive name search, no matches, clear, navigation and per-user recent ordering pass existing tests and browser checks. |
| AT-42 | Test board lists, access restrictions, search, ordering, and navigation | Partial | Existing list tests pass; new acceptance checks reproduce inaccurate dynamic counts. |
| AT-91 | As a developer, I want every external system behind an interface, so that the app runs fully without FLINT access. | Pass | Core external interfaces/factory/mock adapters and tests exist. Optional read-only OPC-through-Foundry stretch adapter is absent and not required for this core verdict. |
| AT-227 | Define external-system interfaces and configuration | Pass | Projects/employees/groups/organizations/attachments/notifications use replaceable interfaces and mock configuration; real mode fails clearly. |
| AT-228 | Implement realistic mocks for a fully runnable app | Pass | Synthetic mocks run without FLINT access, including users, projects, groups, organizations, attachments and notifications. |
| AT-229 | Test run on adapters and mocks | Pass | Mock adapter/factory tests pass. Friday demo, reviewed PR and Jira PR links require team confirmation. |

### AT Sprint 2

| Jira | Issue | Verdict | Evidence / remaining criteria |
|---|---|---|---|
| AT-3 | As a user, I can view project action items in a table so I can review their details | Partial | Table loads real mock API items with required columns; full grid navigation/history/retry and shared section model are incomplete. |
| AT-8 | Build the project action items table to match the approved Figma mockup | Partial | Responsive FLINT-style table and 390px internal scrolling pass. Exact approved Figma and supplied client tracker were not provided for fidelity signoff. |
| AT-9 | Load the selected project's action items into the table | Pass | Selected-board item loads and Project/Team isolation pass API and UI tests. |
| AT-10 | Handle loading, empty results and erros in the action items table | Pass | Table loading, empty, failure, retry and no-match states have passing automated coverage. |
| AT-11 | Test the action items table for correct data, loading, empty results, and errors | Pass | Table data/loading/empty/error regression tests pass; this does not certify other story criteria. |
| AT-43 | Group table items by section using the shared board section data | Fail | Grouping uses item.section strings, not saved board section order. Empty section produces a blank heading; no shared section-order model/API. |
| AT-44 | Implement inline table editing with Tab and Enter navigation | Fail | Target/priority edits persist and nonmembers are denied, but these edits have no history. Failed priority drafts close; status failure falsely announces success. Grid-style Enter navigation and member editing-role restrictions are not established. |
| AT-50 | As a curator, I want to group items under headings such as Early Procurement Items, so that the list reads like our trackers. | Fail | Section headings render, but add/rename/reorder controls and persistence are absent; unsectioned heading is blank. |
| AT-54 | As a curator, I want to type an action into a section and press Enter, so that capturing items in a meeting is fast. | Fail | Quick-add saves title-only items, but status defaults to Not Started instead of Open, entry is global rather than per-section, and keyboard focus is lost after Enter. |
| AT-66 | As a curator, I want a target that can be words or a date, so that real targets like "ASAP", "Before job walk" and "Next OAC?" fit. | Pass | Text/date controls, exact multiline text, preserved type, date validation and date-first sorting pass in mocks. Full item panel is a later-sprint feature. |
| AT-68 | As a contributor, I want to change status in one click, so that updates are quick. | Partial | All six statuses save and record actor/time/old/new history; failed integrated save has false success announcement and no chooser Retry. |
| AT-70 | As a curator, I want a priority indicator on every item, so that the list shows what matters first. | Partial | Priority labels/colors, shared updates and sorting/filtering in Priority tools work. Inline editor ignores configured additional levels and loses failed draft selection. |
| AT-104 | Build section add, rename and reorder controls | Fail | No section add/rename/reorder controls exist in the integrated workspace. |
| AT-105 | Persist section names, order and unsectioned items | Fail | No shared section persistence API/model for names/order; empty string sections are not normalized to a default heading. |
| AT-106 | Test create and name sections | Fail | The new acceptance audit demonstrates unmet parent criteria; passing suite has no working section-management behavior to certify. |
| AT-116 | Build keyboard quick-add within a section | Fail | One global input, not an input in each section. Enter creates the item but activeElement becomes BODY, preventing continuous keyboard entry. Blank submission is silently disabled/ignored rather than flagged inline. |
| AT-117 | Save quick-added items with board defaults | Fail | Item persists and failed saves preserve title; default status is Not Started. Section choice and board-configured default priority are not modeled. |
| AT-118 | Test add an item quickly | Fail | Existing creation/error tests pass; new browser/API acceptance checks fail required defaults/section/focus behavior. |
| AT-152 | Build target entry for exact text or calendar date | Pass | Table text/date entry and exact text preservation are covered by existing tests and Project/Team API probes. |
| AT-153 | Store typed targets and implement date-first sorting | Pass | Typed targets persist after reload; frontend tests cover date-first sorting. |
| AT-154 | Test set a target as text or a date | Pass | Target validation, unauthorized access, load/save/network failure and preserved draft coverage pass. General item-history requirements are tracked under AT-44. |
| AT-158 | Build one-click item status control | Pass | Six default statuses and keyboard chooser behavior pass. Integrated failure behavior is tracked under AT-160. |
| AT-159 | Save item status changes and record history | Pass | Both board types share saved status/history; service serializes status changes and tests cover history sequencing. |
| AT-160 | Test move an item through statuses | Partial | Normal/validation/access cases pass; injected HTTP 500 in integrated table reproduces old pill plus false success announcement and missing Retry. |
| AT-164 | Build labeled priority indicators and editor | Partial | High/Medium/Low labels and colors work. Supplying Urgent from priorities API leaves inline choices hardcoded to the initial three. |
| AT-165 | Persist configurable priorities and support sort/filter | Partial | Backend supports configured service levels and shared priority writes; secondary Priority tools sort/filter. Table inline editor does not consume the levels API. |
| AT-166 | Test set priority | Partial | Existing editor/panel/synchronization tests pass; integrated config and failed-draft acceptance probes fail. |

## Repeat the audit

Run from the repository root with the backend requirements installed:

```bash
APP_MODE=mock PYTHONPATH=backend python scripts/audit_sprints.py
python -m pytest backend/tests -q
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Windows Command Prompt for the extra API probes:

```bat
set APP_MODE=mock
set PYTHONPATH=backend
python scripts\audit_sprints.py
```

The standalone API probe script uses a fresh in-memory board service and prints a JSON report, including expected criteria failures. It is intentionally separate from the regression suite and does not modify Jira. Its process exit is not a CI acceptance gate; inspect the `failed` count. Machine-readable evidence from this run is stored alongside this report:

- [API probe results](sprint-1-2-api-results.json)
- [Browser probe results](sprint-1-2-browser-results.json)

Browser checks used headless Chromium against the actual local app. API failures and alternative priority configuration were injected into the browser's request interception, so they do not alter production data or configuration. The machine-readable results record the exact observed values. Existing Vitest tests cover additional loading/empty/retry, target sorting, keyboard chooser, and per-user history paths.

## Suggested repair order

1. Fix false status success/retry and validate combined item PATCH atomically.
2. Fix quick-add Open default and continuous keyboard focus; derive live open counts.
3. Implement shared section data and section add/rename/reorder with per-section quick entry/default heading.
4. Add metadata editing/project linking and project lookup retry; agree the mock folder-to-URL mapping.
5. Record target/priority history and connect inline priorities to configured levels.
6. Rerun the failing probes and verify current Figma/client-tracker references before marking the stories accepted.
