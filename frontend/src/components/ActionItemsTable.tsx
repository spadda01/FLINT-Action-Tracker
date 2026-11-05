import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  displayTarget,
  dateFirstSorting,
  targetFromInput,
  type Target,
  type TargetDisplay,
} from '../target'
import {
  loadActionItems,
  saveActionItemTarget,
  type ActionItem,
} from '../services/actionItemService'
import {
  announcePriorityUpdate,
  subscribeToPriorityUpdates,
  announceActionItemCreated,
} from '../services/priorityEvents'
import { changeItemStatus } from '../services/itemStatusService'
import StatusChooser from './StatusChooser'

// Additional fields used by the existing board table.
// The shared ActionItem type in actionItemService should also
// include these fields.
type ActionOwner = {
  name: string
  isExternal: boolean
}

type BoardActionItem = ActionItem & {
  section: string
  owners: ActionOwner[]
  hardDate: string | null
  status: string
  attention: boolean
}

type EditableField = 'priority'

type EditingCell = {
  itemId: BoardActionItem['id']
  field: EditableField
}

type RowStatus = {
  kind: 'saved' | 'error'
  message: string
  invalid?: boolean
}

type Props = {
  boardId: string
}

function targetForSort(target: TargetDisplay): Target {
  return target.type === 'date'
    ? { type: 'date', value: target.value }
    : { type: 'text', value: target.value }
}

// Convert stored YYYY-MM-DD dates into readable table dates.
function formatHardDate(date: string | null): string {
  if (!date) return '—'

  const [year, month, day] = date.split('-').map(Number)
  const parsedDate = new Date(Date.UTC(year, month - 1, day))

  return parsedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function ActionItemsTable({ boardId }: Props) {
  const [items, setItems] = useState<BoardActionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  // Existing table editing state.
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Quick-entry state.
  const [newItemTitle, setNewItemTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Target editing state.
  const [drafts, setDrafts] = useState<Record<string, TargetDisplay>>({})
  const [targetStatuses, setTargetStatuses] = useState<
    Record<string, RowStatus>
  >({})
  const [savingItemIds, setSavingItemIds] = useState<string[]>([])
  const [isSorted, setIsSorted] = useState(false)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [searchText, setSearchText] = useState('')

  // Keep priority changes synchronized with the priority panel.
  useEffect(() => {
    return subscribeToPriorityUpdates(
      ({ boardId: updatedBoardId, itemId, priority }) => {
        if (updatedBoardId !== boardId) return

        setItems((previousItems) =>
          previousItems.map((item) =>
            item.id === itemId ? { ...item, priority } : item,
          ),
        )
      },
    )
  }, [boardId])

  // Load the board's shared action items.
  useEffect(() => {
    let cancelled = false

    async function loadItems() {
      setIsLoading(true)
      setError(null)

      try {
        const loadedItems = await loadActionItems(boardId)

        if (!cancelled) {
          const boardItems = loadedItems as BoardActionItem[]

          setItems(boardItems)

          setDrafts(
            Object.fromEntries(
              boardItems.map((item) => [
                String(item.id),
                displayTarget(item.target),
              ]),
            ),
          )

          setTargetStatuses({})
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load action items. Please try again.')
          setItems([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [boardId, loadAttempt])

  // Sort by target when requested.
  // Date targets appear before text targets.
  // Original order is preserved when targets compare equally.
  const visibleItems = useMemo(() => {
    // Filter first, then apply the existing target sorting.
    const query = searchText.trim().toLowerCase()
    const filteredItems = items.filter(
      (item) =>
        (!attentionOnly || item.attention) &&
        (!query ||
          [
            item.title,
            item.section,
            ...item.owners.map((owner) => owner.name),
          ].some((value) => value.toLowerCase().includes(query))),
    )

    if (!isSorted) return filteredItems

    return filteredItems
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const leftTarget =
          drafts[String(left.item.id)] ?? displayTarget(left.item.target)

        const rightTarget =
          drafts[String(right.item.id)] ?? displayTarget(right.item.target)

        const [leftGroup, leftValue] = dateFirstSorting(
          targetForSort(leftTarget),
        )

        const [rightGroup, rightValue] = dateFirstSorting(
          targetForSort(rightTarget),
        )

        return (
          leftGroup - rightGroup ||
          leftValue.localeCompare(rightValue) ||
          left.index - right.index
        )
      })
      .map(({ item }) => item)
  }, [attentionOnly, drafts, isSorted, items, searchText])

  // Group items by section while preserving their current order.
  const groupedItems = useMemo(
    () =>
      visibleItems.reduce<Record<string, BoardActionItem[]>>((groups, item) => {
        if (!groups[item.section]) {
          groups[item.section] = []
        }

        groups[item.section].push(item)
        return groups
      }, {}),
    [visibleItems],
  )

  // Start editing an existing table field.
  function startEditing(itemId: BoardActionItem['id'], field: EditableField) {
    setEditingCell({ itemId, field })
  }

  // Update an unsaved target draft.
  function updateDraft(itemId: BoardActionItem['id'], draft: TargetDisplay) {
    const key = String(itemId)

    setDrafts((current) => ({
      ...current,
      [key]: draft,
    }))

    setTargetStatuses((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  // Validate and save a target through the shared action-item service.
  async function saveTarget(item: BoardActionItem) {
    const key = String(item.id)
    const draft = drafts[key] ?? displayTarget(item.target)

    let target: Target

    try {
      target = targetFromInput(draft.type, draft.value)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error

      setTargetStatuses((current) => ({
        ...current,
        [key]: {
          kind: 'error',
          invalid: true,
          message:
            draft.type === 'date'
              ? 'Enter a valid calendar date.'
              : 'Enter a valid target.',
        },
      }))

      return
    }

    setSavingItemIds((current) =>
      current.includes(key) ? current : [...current, key],
    )

    setTargetStatuses((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })

    try {
      const savedItem = await saveActionItemTarget(boardId, item.id, target)

      const updatedItem = savedItem as BoardActionItem

      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem,
        ),
      )

      setDrafts((current) => ({
        ...current,
        [String(updatedItem.id)]: displayTarget(updatedItem.target),
      }))

      setTargetStatuses((current) => ({
        ...current,
        [key]: {
          kind: 'saved',
          message: 'Target saved.',
        },
      }))
    } catch (error) {
      setTargetStatuses((current) => ({
        ...current,
        [key]: {
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The target could not be saved. Your change is kept so you can try again.',
        },
      }))
    } finally {
      setSavingItemIds((current) => current.filter((itemId) => itemId !== key))
    }
  }

  // Save priority changes to the backend.
  async function savePriority(
    itemId: BoardActionItem['id'],
    newPriority: string,
  ) {
    setSaveError(null)

    try {
      const response = await fetch(
        `/api/boards/${encodeURIComponent(boardId)}/items/${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priority: newPriority,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save priority')
      }

      const updatedItem = (await response.json()) as BoardActionItem

      setItems((previousItems) =>
        previousItems.map((item) => (item.id === itemId ? updatedItem : item)),
      )

      announcePriorityUpdate({
        boardId,
        itemId,
        priority: updatedItem.priority,
      })
    } catch (error) {
      console.error('Error saving priority:', error)
      setSaveError('Unable to save your changes. Please try again.')
    }
  }

  // Save status through the status service so history is recorded.
  async function saveStatus(itemId: BoardActionItem['id'], newStatus: string) {
    try {
      const result = await changeItemStatus(boardId, itemId, newStatus)

      setItems((previousItems) =>
        previousItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: result.item.status,
              }
            : item,
        ),
      )
    } catch (error) {
      console.error('Error saving status:', error)
      setSaveError('Unable to save the status change. Please try again.')
    }
  }

  // Create a new action item through the existing board endpoint.
  async function createActionItem() {
    const title = newItemTitle.trim()

    if (!title || isCreating) return

    setIsCreating(true)
    setCreateError(null)

    try {
      const response = await fetch(
        `/api/boards/${encodeURIComponent(boardId)}/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to create action item')
      }

      const createdItem = (await response.json()) as BoardActionItem

      setItems((previousItems) => [...previousItems, createdItem])

      setDrafts((current) => ({
        ...current,
        [String(createdItem.id)]: displayTarget(createdItem.target),
      }))

      // Notify the priority panel that a new item is available.
      announceActionItemCreated({ boardId })

      setNewItemTitle('')
    } catch (error) {
      console.error('Error creating action item:', error)
      setCreateError('Unable to create action item. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section
      className="board-list action-items"
      aria-labelledby="action-items-heading"
    >
      <h2 id="action-items-heading">Action Items</h2>

      {saveError && (
        <p className="action-save-error" role="alert">
          {saveError}
        </p>
      )}

      {createError && (
        <p className="action-save-error" role="alert">
          {createError}
        </p>
      )}

      {isLoading ? (
        <p role="status">Loading action items...</p>
      ) : error ? (
        <div>
          <p role="alert">{error}</p>
          <button
            type="button"
            className="boards-retry"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Retry loading action items
          </button>
        </div>
      ) : (
        <>
          <div className="action-toolbar">
            <label className="action-search">
              <span className="visually-hidden">Search action items</span>
              <input
                type="search"
                placeholder="Search actions or owners"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="target-sort"
              aria-pressed={isSorted}
              onClick={() => setIsSorted((sorted) => !sorted)}
            >
              {isSorted ? 'Clear target sort' : 'Sort by target'}
            </button>

            <button
              type="button"
              aria-pressed={attentionOnly}
              onClick={() => setAttentionOnly((current) => !current)}
            >
              {attentionOnly ? 'Show all items' : 'Needs attention only'}
            </button>

            <button
              type="button"
              className="add-action-button"
              onClick={() => {
                document
                  .querySelector<HTMLInputElement>(
                    '[aria-label="New action item title"]',
                  )
                  ?.focus()
              }}
            >
              + Add action item
            </button>
          </div>

          <div
            style={{
              overflowX: 'auto',
              width: '100%',
            }}
          >
            <table
              className="action-items-table"
              style={{
                minWidth: '1000px',
                width: '100%',
              }}
            >
              <thead>
                <tr>
                  <th scope="col">Priority</th>
                  <th scope="col">Deliverable / Action</th>
                  <th scope="col">Owners</th>
                  <th scope="col">Target</th>
                  <th scope="col">Hard Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attention</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No action items found.</td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      No action items match your search or filter.
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedItems).map(
                    ([section, sectionItems]) => (
                      <Fragment key={section}>
                        <tr className="section-header">
                          <th colSpan={7} scope="rowgroup">
                            {section}
                          </th>
                        </tr>

                        {sectionItems.map((item) => {
                          const key = String(item.id)
                          const draft =
                            drafts[key] ?? displayTarget(item.target)
                          const targetStatus = targetStatuses[key]
                          const isSaving = savingItemIds.includes(key)

                          return (
                            <tr key={item.id}>
                              {/* Priority */}
                              <td>
                                {editingCell?.itemId === item.id &&
                                editingCell.field === 'priority' ? (
                                  <select
                                    defaultValue={item.priority}
                                    aria-label={`Edit priority for ${item.title}`}
                                    autoFocus
                                    onChange={(event) => {
                                      void savePriority(
                                        item.id,
                                        event.currentTarget.value,
                                      )
                                      setEditingCell(null)
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Escape') {
                                        event.preventDefault()
                                        setEditingCell(null)
                                      }
                                    }}
                                  >
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                  </select>
                                ) : (
                                  <button
                                    type="button"
                                    className={`priority priority-${item.priority.toLowerCase()}`}
                                    onClick={() =>
                                      startEditing(item.id, 'priority')
                                    }
                                    aria-label={`Edit priority for ${item.title}`}
                                  >
                                    <span
                                      className="priority-dot"
                                      aria-hidden="true"
                                    />
                                    {item.priority}
                                  </button>
                                )}
                              </td>

                              {/* Deliverable / Action */}
                              <td>{item.title}</td>

                              {/* Owners */}
                              <td>
                                <div className="action-owners">
                                  {item.owners.map((owner, index) => (
                                    <span
                                      className="action-owner"
                                      key={`${owner.name}-${index}`}
                                    >
                                      {owner.name}

                                      {owner.isExternal && (
                                        <span className="external-tag">
                                          External
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </td>

                              {/* Typed target editor */}
                              <td>
                                <label
                                  className="visually-hidden"
                                  htmlFor={`target-type-${item.id}`}
                                >
                                  Target type for {item.title}
                                </label>

                                <select
                                  id={`target-type-${item.id}`}
                                  value={draft.type}
                                  disabled={isSaving}
                                  onChange={(event) => {
                                    const type = event.currentTarget.value

                                    if (type !== 'text' && type !== 'date') {
                                      return
                                    }

                                    updateDraft(item.id, {
                                      type,
                                      value:
                                        type === 'date' && draft.type !== 'date'
                                          ? ''
                                          : draft.value,
                                    })
                                  }}
                                >
                                  <option value="text">Text</option>
                                  <option value="date">Date</option>
                                </select>

                                <label
                                  className="visually-hidden"
                                  htmlFor={`target-value-${item.id}`}
                                >
                                  Target for {item.title}
                                </label>

                                {draft.type === 'date' ? (
                                  <input
                                    id={`target-value-${item.id}`}
                                    type="date"
                                    value={draft.value}
                                    disabled={isSaving}
                                    aria-invalid={
                                      targetStatus?.invalid ?? false
                                    }
                                    onChange={(event) =>
                                      updateDraft(item.id, {
                                        ...draft,
                                        value: event.target.value,
                                      })
                                    }
                                  />
                                ) : (
                                  <textarea
                                    id={`target-value-${item.id}`}
                                    rows={2}
                                    value={draft.value}
                                    disabled={isSaving}
                                    aria-invalid={
                                      targetStatus?.invalid ?? false
                                    }
                                    onChange={(event) =>
                                      updateDraft(item.id, {
                                        ...draft,
                                        value: event.target.value,
                                      })
                                    }
                                  />
                                )}

                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => void saveTarget(item)}
                                >
                                  {isSaving ? 'Saving...' : 'Save target'}
                                </button>

                                {isSaving && (
                                  <p role="status">Saving target...</p>
                                )}

                                {targetStatus?.kind === 'saved' && (
                                  <p role="status">{targetStatus.message}</p>
                                )}

                                {targetStatus?.kind === 'error' && (
                                  <p role="alert">{targetStatus.message}</p>
                                )}
                              </td>

                              {/* Hard Date */}
                              <td className="hard-date">
                                {formatHardDate(item.hardDate)}
                              </td>

                              {/* Status */}
                              <td>
                                <StatusChooser
                                  itemTitle={item.title}
                                  status={item.status}
                                  onChange={(next) => saveStatus(item.id, next)}
                                />
                              </td>

                              {/* Attention */}
                              <td>
                                {item.attention ? (
                                  <span
                                    className="attention-flag"
                                    role="img"
                                    aria-label="Needs attention"
                                  >
                                    ⚠
                                  </span>
                                ) : (
                                  <span
                                    className="attention-none"
                                    aria-label="No attention needed"
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ),
                  )
                )}

                {/* Quick-entry row */}
                <tr className="quick-entry-row">
                  <td colSpan={7}>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        void createActionItem()
                      }}
                    >
                      <input
                        type="text"
                        value={newItemTitle}
                        onChange={(event) =>
                          setNewItemTitle(event.target.value)
                        }
                        placeholder="+ Add an action item"
                        aria-label="New action item title"
                        disabled={isCreating}
                      />

                      <button
                        type="submit"
                        disabled={isCreating || !newItemTitle.trim()}
                      >
                        {isCreating ? 'Adding...' : 'Add Item'}
                      </button>
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export default ActionItemsTable
