# AT-68 — Move an item through statuses: test results

Story: AT-68 (client story 5.3) · Subtasks: AT-158 status chooser, AT-159 save and history, AT-160 tests and demo
Tested by: Fahim · Date: 2026-10-29 · Branch: `Fahim/AT-68` · Data: mocks only (no FLINT OS, Entra or OPC connection)

## Summary

| Area | Tests | Passed | Failed |
|---|---|---|---|
| Status API (backend, pytest, `tests/test_item_status.py`) | 36 | 36 | 0 |
| Status chooser (frontend, Vitest, `StatusChooser.test.tsx`) | 19 | 19 | 0 |
| Status service (frontend, `itemStatusService.test.ts`) | 14 | 14 | 0 |
| Chooser and service together (frontend, `StatusChooser.integration.test.tsx`) | 7 | 7 | 0 |
| **Total for this story** | **76** | **76** | **0** |

Full suites on the branch: backend 121 passed, frontend 70 passed. Lint and build are clean.

Both client acceptance criteria pass. The chooser is not yet placed in the action items table, because the table is on `SaihajP/AT-8`, which isn't merged yet (see "Not covered yet").

## How to run

```bash
cd backend && .venv/bin/python -m pytest tests/test_item_status.py -v
```
```bash
cd frontend && npm test
```

## Results by acceptance criterion

**Status:** Pass · Partial · Blocked (it depends on work that isn't done yet)

### Client criterion 1 — Default statuses: Open, Not Started, In Progress, Scheduled, Outstanding, Complete

| # | Check | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|
| 1.1 | Chooser lists the default statuses | Six statuses in the client's order | As expected | Pass | `lists the six default statuses in order…` |
| 1.2 | Server returns the board status list | Same six, same order | As expected | Pass | `test_board_status_list_is_the_six_defaults_in_order` |
| 1.3 | Every default status can be saved | 200 for each | As expected | Pass | `test_every_default_status_can_be_saved` (×6) |
| 1.4 | An item can move through all six in turn | Each step saves | As expected | Pass | `test_an_item_can_move_through_every_status…` |
| 1.5 | Statuses outside the list are refused | 422 with the allowed list. Nothing saved | As expected ("Done", wrong case, "On Hold", blank, missing, wrong type) | Pass | `test_unknown_status_is_rejected`, `test_status_is_required`, `test_status_of_the_wrong_type…` |
| 1.6 | Status changes in one click | One click on a status saves it | As expected, with one PATCH request | Pass | `sends one PATCH request and shows the saved status` |

### Client criterion 2 — Each change is recorded in history

| # | Check | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|
| 2.1 | A change records actor, time, old and new status | All four stored | As expected | Pass | `test_change_records_actor_time_old_and_new_status` |
| 2.2 | Every change is kept, newest first | 3 changes give 3 entries | As expected | Pass | `test_every_change_is_kept_in_history_newest_first` |
| 2.3 | Each user is recorded correctly | user-1 and user-2 both appear | As expected | Pass | `test_history_records_which_user_made_each_change` |
| 2.4 | Time is recorded in UTC | ISO time with +00:00 | As expected | Pass | `test_real_clock_records_utc_time` |
| 2.5 | Re-picking the same status adds no history | No new entry | As expected | Pass | `test_same_status_again_changes_nothing…` |
| 2.6 | A refused change adds no history | No entry | As expected | Pass | `test_rejected_change_saves_nothing` |
| 2.7 | History and item agree (same item state) | Latest entry's new status = item status | As expected | Pass | `test_latest_history_entry_matches_the_item_status` |
| 2.8 | Changes persist between requests | Next request sees the saved status | As expected | Pass | `test_changes_persist_between_requests` |

### Completion checks (AT-158, AT-159, AT-160)

| # | Check | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|
| 3.1 | Board members can change status | 200 | As expected, on project and team boards | Pass | `test_change_status_saves…`, `test_team_boards_support_status_changes` |
| 3.2 | Non-members can't read or change items | 404, nothing saved | As expected | Pass | `test_non_member_cannot_change_status` |
| 3.3 | Restricted, archived and missing boards hidden | 404 for statuses, change and history | As expected | Pass | `test_boards_the_user_cannot_open_are_hidden` (×3) |
| 3.4 | Unknown user refused | 401 | As expected | Pass | `test_unknown_user_is_rejected` |
| 3.5 | API off unless mock mode is on | 503 | As expected | Pass | `test_status_api_is_off_outside_mock_mode` |
| 3.6 | Users who can't edit see no control | Plain status, no request sent | As expected | Pass | `shows the status as plain text…`, `sends no request for a user who cannot edit` |
| 3.7 | Keyboard: open, move, wrap, Home/End, select, Escape, Tab | Works without a mouse | As expected | Pass | 5 keyboard tests, `saves using only the keyboard` |
| 3.8 | Saving state | "Saving…", no double save | As expected | Pass | `shows a saving state while the save is in progress` |
| 3.9 | Save failure keeps the old status and says why | Alert with reason | As expected (422, 404, 500) | Pass | Integration tests |
| 3.10 | Connection lost | Clear message. Retry works when back | As expected | Pass | `explains a lost connection and saves on retry…` |
| 3.11 | Invalid input | 422 with a message | As expected | Pass | See 1.5 |
| 3.12 | Unknown item, or item from another board | 404 | As expected | Pass | `test_unknown_item_returns_404`, `test_item_from_another_board_returns_404` |
| 3.13 | Empty state (board with no statuses) | Read-only with a note | As expected | Pass | `explains when the board has no statuses set up` |
| 3.14 | Load failure for the status list or history | Clear message | Service gives a message. No screen loads these yet | Partial | `loadBoardStatuses` / `loadStatusHistory` tests |
| 3.15 | Every adapter can be mocked | Runs fully on mocks | Item and history stores are in-memory, behind interfaces | Pass | All tests above |
| 3.16 | OPC receives no writes | No OPC calls | No OPC code anywhere in this story | Pass | Code review |
| 3.17 | Status changed from the action items table | Chooser in each row's status column | Table not on `main` yet | Blocked | Needs `SaihajP/AT-8` merged |
| 3.18 | Table and history read the same stored item | One shared store | This story's store and the table's mock store are separate until AT-8 merges | Blocked | Needs the shared item store |

No failures, so no bug reports for this story.

## Friday demo script

About 5 minutes. Start the backend in mock mode:

```bash
cd backend && APP_MODE=mock MOCK_USER_ID=user-1 .venv/bin/uvicorn app.main:app --reload
```

Open http://localhost:8000/docs and use the **Item status** section:

1. **Default statuses:** `GET /api/boards/project-1/statuses` lists the six statuses in order. *(Criterion 1)*
2. **Change a status:** `PATCH /api/boards/project-1/items/2/status` with `{"status": "Scheduled"}` returns 200, and the response shows who, when, old and new.
3. **Change it again:** the same request with `"Complete"`.
4. **History:** `GET /api/boards/project-1/items/2/history` shows both changes, newest first. *(Criterion 2)*
5. **Invalid status:** PATCH with `"Done"` returns 422 with the allowed list.
6. **No access:** PATCH on `team-restricted` returns 404.
7. **Team board:** PATCH on `team-1`, item 4, works the same way.

Then show the chooser and its error states by running the tests:

```bash
cd frontend && npx vitest run src/components/StatusChooser --reporter verbose
```

Point out the keyboard, saving, failure, lost-connection and read-only tests by name.

## Not covered yet

- **Chooser in the action items table (3.17)** and **one shared item store (3.18):** when `SaihajP/AT-8` merges, do three things:
  - make the status endpoints use the same item store as `GET /api/boards/{id}/items`
  - place `StatusChooser` in the table's status column, calling `changeItemStatus`
  - re-run this document's checks in the browser
- **Load-failure screens (3.14):** the history and status-list API calls are ready, but no screen uses them yet. Check whether the Figma design has a history view.
- **Visual check against the Figma design:** not done in this run.
