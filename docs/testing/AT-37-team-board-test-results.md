# AT-37 — Team board creation: test results

Story: AT-34 *Create a team board*
Tested by: Fahim · Date: 2026-10-17 · Data: mocks only (no Entra, Egnyte or FLINT OS connection)

| Part | Owner | Code tested |
|---|---|---|
| Subtask 1 — creation form | Max | `origin/maxgrot` @ `b88ebf6`, `Project_Board/src/pages/CreateTeamBoard.tsx` |
| Subtask 2 — member picker | Max | same file |
| Subtask 3 — save team board (AT-36) | Fahim | `Fahim/AT-36-37` @ `4db14cd` (backend + `frontend/src/services`) |

## Summary

| Area | Automated checks | Passed | Failed |
|---|---|---|---|
| Save API (backend, pytest) | 29 | 29 | 0 |
| Save service and messages (frontend, Vitest) | 18 | 18 | 0 |
| Form and member picker (Max's branch, Vitest) | 17 | 9 | 8 |

The save backend and frontend save service meet their criteria. The form and member picker fail 8 checks (6 bug drafts below). The form is not connected to the save API yet, so the full create → save → reopen flow cannot be tested end to end.

## How to run

```bash
cd backend && python -m pytest
```
```bash
cd frontend && npm test
```

The form and picker checks live in [`at-35-36-form-checks.test.tsx`](at-35-36-form-checks.test.tsx). They ran against a copy of `Project_Board/` with Vitest and Testing Library added. Move them into `frontend/src/pages/` once the form is moved into `frontend/`.

## Results by acceptance criterion

**Status:** Pass · Fail · Partial · Blocked (it depends on work that isn't done yet)

| # | Criterion | Expected | Actual | Status | Evidence | Bug |
|---|---|---|---|---|---|---|
| 1 | Team board can be created with name, members and Egnyte link | Valid input saves a board | API saves and returns the board (201). Form submits valid input but is not wired to the API | Partial | `test_create_team_board`, F3b | — |
| 2a | Individual users can be selected and removed | User can pick and remove users | Picks and removes users from a dropdown | Pass | F3b, M4 | — |
| 2b | Users can be searched | Typing filters users | No search field, only a plain dropdown | Fail | M1 | BUG-4 |
| 2c | Entra groups can be selected | Group can be picked | Choosing "Example Team (Group)" selects the blank option (the label appears twice) | Fail | M2 | BUG-5 |
| 2d | Users and groups are clearly distinguished | Different marker or section for groups | Only a "(Group)" suffix in the name | Partial | Manual review | — |
| 3 | Duplicate user or group selections prevented | Same member can't be added twice | Form hides already-picked options. API rejects duplicates (422) | Pass | M5, `test_duplicate_members_are_rejected` | — |
| 4 | Saved board has no project attached | `type: Team`, `projectId: null`. Project link refused | As expected. A `projectId` in the request is rejected | Pass | `test_create_team_board`, `test_team_board_cannot_have_a_project`, service test "does not send a project link" | — |
| 5 | Saved information correct after reopening | Reopened board matches what was saved | `GET /api/boards/{id}` returns identical data. No UI screen to reopen a board yet | Partial | `test_reopened_board_keeps_saved_information`, `getBoard` tests | — |
| 6a | Name, members and link required (form) | Can't submit with missing fields | Submit button disabled until all three are filled | Pass | F3a | — |
| 6b | Missing fields flagged beside the control | Message next to each missing field | No messages. Button is just greyed out | Fail | F4 | BUG-1 |
| 6c | Required fields validated on the server | 422 with a message per field | Name, members, link and project checks all enforced | Pass | 12 validation tests in `test_team_boards.py` | — |
| 6d | Values kept when validation fails | Entered values remain | Values remain | Pass | F5 | — |
| 7a | Keyboard: Tab reaches every control in order | Close → name → member → add → link → cancel | As expected | Pass | F6a | — |
| 7b | Keyboard: Escape closes, and it behaves as a dialog | Escape calls close; `role="dialog"` | Escape does nothing. Not exposed as a dialog | Fail | F6b, F6c | BUG-2 |
| 8a | Loading failure shows a message and keeps selections | Message shown, selections kept | Member options are hardcoded. There is no loading step to fail | Blocked | — | — |
| 8b | Save failure shows a clear message and keeps entries | Alert message. Entries unchanged. Retry works | As expected (server error, unreachable server, field errors) | Pass | `useSaveTeamBoard.test.tsx`, `SaveStatusMessage.test.tsx` | — |
| 8c | Success shows a clear message | "Team board … was created." | As expected | Pass | `useSaveTeamBoard.test.tsx` | — |
| 9 | Team boards support shared sections, items, views | Same features as project boards | Sections, items and views are not built yet. Team and project boards share one board model | Blocked | — | — |
| 10 | Members sent in a form the save API accepts | `{id, type: "user" \| "group"}` | Form sends display names (e.g. `"Alex Johnson"`) | Fail | M6 | BUG-6 |
| 11 | Submit button wording | "Create board" or similar | Says "Add item" | Fail | F8 | BUG-3 |

## Bug drafts (for Jira)

**BUG-1: Missing required fields are not flagged**
- Steps: open the form, fill only the board name, try to submit.
- Expected: a message beside Members and Egnyte link saying they're required.
- Actual: the submit button is disabled with no explanation.

**BUG-2: Form can't be closed with Escape and isn't announced as a dialog**
- Steps: focus any field and press Escape.
- Expected: the form closes. Screen readers announce it as a dialog.
- Actual: nothing happens. The form has no `role="dialog"`.

**BUG-3: Submit button says "Add item"**
- Expected: "Create board".
- Actual: "Add item".

**BUG-4: Member picker has no search**
- Steps: try to find a user by typing part of their name.
- Expected: matching users and groups are listed.
- Actual: a plain dropdown with no search.

**BUG-5: "Example Team (Group)" label is used twice**
- Steps: open the Members dropdown and pick the first "Example Team (Group)".
- Expected: the group is selected.
- Actual: the blank placeholder is selected, because it uses the same label as the group. An empty row also looks like the group is already chosen.

**BUG-6: Members submitted as names instead of IDs and types**
- Steps: fill the form and submit.
- Expected: `members: [{ id: "E001", type: "user" }, …]`, which `POST /api/boards/team` needs.
- Actual: `members: ["Alex Johnson"]`. This blocks connecting the form to the save API.

## Not covered yet

- **End-to-end flow** (create in the form → save → reopen on screen): needs the form moved into `frontend/`, BUG-6 fixed, and a board page to reopen into.
- **Loading-failure handling (8a):** needs the member picker to load users and groups from `GET /api/employees` and `GET /api/groups` instead of hardcoded names.
- **Shared sections, items, views (9):** retest when those features land.
- **Visual check against the Figma design:** not done, because the browser pane could not open the local page during this run.
