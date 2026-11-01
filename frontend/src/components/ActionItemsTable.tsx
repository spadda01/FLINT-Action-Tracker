import { useEffect, useMemo, useState } from 'react'
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

type Props = {
  boardId: string
}

type RowStatus = {
  kind: 'saved' | 'error'
  message: string
  invalid?: boolean
}

function targetForSort(target: TargetDisplay): Target {
  return target.type === 'date'
    ? { type: 'date', value: target.value }
    : { type: 'text', value: target.value }
}

function ActionItemsTable({ boardId }: Props) {
  const [items, setItems] = useState<ActionItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, TargetDisplay>>({})
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [savingItemIds, setSavingItemIds] = useState<string[]>([])
  const [isSorted, setIsSorted] = useState(false)

  useEffect(() => {
    let active = true

    async function fetchItems() {
      setIsLoading(true)
      setLoadError('')

      try {
        const loadedItems = await loadActionItems(boardId)
        if (active) {
          setItems(loadedItems)
          setDrafts(
            Object.fromEntries(
              loadedItems.map((item) => [item.id, displayTarget(item.target)]),
            ),
          )
        }
      } catch {
        if (active) {
          setLoadError('Unable to load action items. Please try again.')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void fetchItems()

    return () => {
      active = false
    }
  }, [boardId, loadAttempt])

  const visibleItems = useMemo(() => {
    if (!isSorted) return items
    return items
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const leftTarget = drafts[left.item.id] ?? displayTarget(left.item.target)
        const rightTarget = drafts[right.item.id] ?? displayTarget(right.item.target)
        const [leftGroup, leftValue] = dateFirstSorting(targetForSort(leftTarget))
        const [rightGroup, rightValue] = dateFirstSorting(targetForSort(rightTarget))
        return (
          leftGroup - rightGroup ||
          leftValue.localeCompare(rightValue) ||
          left.index - right.index
        )
      })
      .map(({ item }) => item)
  }, [drafts, isSorted, items])

  function updateDraft(itemId: string, draft: TargetDisplay) {
    setDrafts((current) => ({ ...current, [itemId]: draft }))
    setStatuses((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== itemId),
      ),
    )
  }

  async function saveTarget(item: ActionItem) {
    const draft = drafts[item.id] ?? displayTarget(item.target)
    let target: Target

    try {
      target = targetFromInput(draft.type, draft.value)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      setStatuses((current) => ({
        ...current,
        [item.id]: {
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
      current.includes(item.id) ? current : [...current, item.id],
    )
    setStatuses((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== item.id),
      ),
    )

    try {
      const savedItem = await saveActionItemTarget(boardId, item.id, target)
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === savedItem.id ? savedItem : currentItem,
        ),
      )
      setDrafts((current) => ({
        ...current,
        [savedItem.id]: displayTarget(savedItem.target),
      }))
      setStatuses((current) => ({
        ...current,
        [savedItem.id]: { kind: 'saved', message: 'Target saved.' },
      }))
    } catch (error) {
      setStatuses((current) => ({
        ...current,
        [item.id]: {
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The target could not be saved. Your change is kept so you can try again.',
        },
      }))
    } finally {
      setSavingItemIds((current) =>
        current.filter((itemId) => itemId !== item.id),
      )
    }
  }

  return (
    <section className="board-list action-items" aria-labelledby="action-items-heading">
      <h2 id="action-items-heading">Action items</h2>

      {isLoading ? (
        <p role="status">Loading action items…</p>
      ) : loadError ? (
        <div>
          <p role="alert">{loadError}</p>
          <button
            type="button"
            className="boards-retry"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Retry loading action items
          </button>
        </div>
      ) : items.length === 0 ? (
        <p role="status">No action items yet.</p>
      ) : (
        <>
          <button
            type="button"
            className="target-sort"
            aria-pressed={isSorted}
            onClick={() => setIsSorted((sorted) => !sorted)}
          >
            {isSorted ? 'Clear target sort' : 'Sort by target'}
          </button>
          <table>
            <thead>
              <tr>
                <th scope="col">Action item</th>
                <th scope="col">Target type</th>
                <th scope="col">Target</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const draft = drafts[item.id] ?? displayTarget(item.target)
                const status = statuses[item.id]
                const isSaving = savingItemIds.includes(item.id)

                return (
                  <tr key={item.id}>
                    <th scope="row">{item.title}</th>
                    <td>
                      <label className="visually-hidden" htmlFor={`target-type-${item.id}`}>
                        Target type for {item.title}
                      </label>
                      <select
                        id={`target-type-${item.id}`}
                        value={draft.type}
                        disabled={isSaving}
                        onChange={(event) => {
                          const type = event.currentTarget.value
                          if (type !== 'text' && type !== 'date') return
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
                    </td>
                    <td>
                      <label className="visually-hidden" htmlFor={`target-value-${item.id}`}>
                        Target for {item.title}
                      </label>
                      {draft.type === 'date' ? (
                        <input
                          id={`target-value-${item.id}`}
                          type="date"
                          value={draft.value}
                          disabled={isSaving}
                          aria-invalid={status?.invalid ?? false}
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
                          aria-invalid={status?.invalid ?? false}
                          onChange={(event) =>
                            updateDraft(item.id, {
                              ...draft,
                              value: event.target.value,
                            })
                          }
                        />
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void saveTarget(item)}
                      >
                        {isSaving ? 'Saving…' : 'Save target'}
                      </button>
                      {isSaving && <p role="status">Saving target…</p>}
                      {status?.kind === 'saved' && (
                        <p role="status">{status.message}</p>
                      )}
                      {status?.kind === 'error' && (
                        <p role="alert">{status.message}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

export default ActionItemsTable
