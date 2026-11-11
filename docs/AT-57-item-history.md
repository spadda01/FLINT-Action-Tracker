# AT-57: Item change history

## Using history

Select History beneath an item's title to view its recorded changes.
Each entry shows the actor ID, local date/time, field, previous value,
and new value. Newest entries appear first.

History is read-only. The dialog supports keyboard operation, Escape,
and returning focus to the History button.

If loading fails, select Retry. An item without recorded changes shows
an empty-history message.

## Backend behavior

The server checks board access and item existence before returning history.

GET /api/boards/{board_id}/items/{item_id}/history
returns general field history.

GET /api/boards/{board_id}/items/{item_id}/status-history
preserves the existing status-only response.

Creation, field updates, separate status/priority updates, section moves,
and section renames record affected item fields. Unchanged values add no
entries. Reordering within the same section does not change item fields
and currently adds no history entry.

History storage exposes append and read operations only. Stored and
returned values are copied to prevent changes through shared references.

## Development limitations

This implementation uses mock data and in-memory history. Restarting or
reloading the backend clears history. Persistent storage must be integrated
before production use.

Actors currently appear as mock user IDs. Times are stored in UTC and
displayed in the browser's local timezone.

Item state and history use in-memory operations under a shared lock.
A persistent implementation must save both in one database transaction.

## Demonstration

1. Open History for an unchanged sample item and show the empty state.
2. Change its priority, then reopen History.
3. Show who, when, field, previous value, and new value.
4. Demonstrate keyboard opening, Escape, and focus restoration.
5. Stop the backend, reopen History, and show the load error.
6. Restart the backend and select Retry.
7. Explain that restarting clears this development mock's history.