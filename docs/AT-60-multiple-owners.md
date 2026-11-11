# AT-60: Multiple owners

## Using owners

Select an item's owner chips to edit its owners.

- Add owners with Add owner.
- Mark external owners using the External checkbox.
- Reorder owners using the up/down buttons.
- Remove owners using the remove button.
- Select Save to apply changes or Cancel to discard the draft.

Chips display owners in saved order with Staff/External labels.
Empty names are rejected. Remove an empty row before saving.
Removing every owner saves an empty list.

Keyboard users can reach the controls with Tab and activate buttons
with Enter or Space. After reordering, focus follows the moved owner's
name input.

Failed saves preserve the draft and offer Retry save.

## Backend behavior

Owner names are trimmed and whitespace-only names are rejected.
The item endpoint preserves owner order and staff/external distinctions.
Board access is checked before updates are allowed.

## History dependency

Recording owner changes depends on AT-57's general item history.
Integration must verify additions, removals, reordering, and type changes.

## Mock limitations

Owners currently use names and an external flag, without directory IDs.
Saved mock items survive page refreshes but reset on backend restart.
Production persistence and directory integration remain separate work.