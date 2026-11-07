import { useEffect, useState } from 'react'
import { loadItemHistory } from '../services/itemHistoryService'
import type { ItemHistoryEntry, JsonValue } from '../types/itemHistory'
import './ItemHistory.css'

type ItemHistoryProps = {
  boardId: string
  itemId: number
}

const fieldLabels: Record<string, string> = {
  title: 'Title',
  section: 'Section',
  priority: 'Priority',
  owners: 'Owners',
  target: 'Target',
  hardDate: 'Hard date',
  status: 'Status',
  attention: 'Attention',
}

function formatValue(value: JsonValue): string {
  if (value === null) return 'Not set'
  if (value === '') return 'Empty'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) {
    return value.length ? value.map(formatValue).join('; ') : 'None'
  }

  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${formatValue(entry)}`)
    .join(', ')
}

function HistoryContent({ boardId, itemId }: ItemHistoryProps) {
  const [entries, setEntries] = useState<ItemHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchHistory() {
      try {
        const result = await loadItemHistory(
          boardId,
          itemId,
          controller.signal,
        )

        if (!controller.signal.aborted) setEntries(result)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to load history. Please try again.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void fetchHistory()
    return () => controller.abort()
  }, [boardId, itemId, attempt])

  function retry() {
    setError('')
    setIsLoading(true)
    setAttempt((value) => value + 1)
  }

  return (
    <section className="item-history" aria-label="Item change history">
      <h3>Change history</h3>

      {isLoading ? (
        <p role="status">Loading history…</p>
      ) : error ? (
        <div>
          <p role="alert">{error}</p>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p>No changes have been recorded for this item.</p>
      ) : (
        <ol className="item-history-list">
          {entries.map((entry) => (
            <li key={entry.id} className="item-history-entry">
              <p>
                <strong>{fieldLabels[entry.field] ?? entry.field}</strong>
                {' changed by '}
                {entry.actorId}
              </p>
              <time dateTime={entry.changedAt}>
                {new Date(entry.changedAt).toLocaleString()}
              </time>
              <dl>
                <dt>Previous value</dt>
                <dd>{formatValue(entry.oldValue)}</dd>
                <dt>New value</dt>
                <dd>{formatValue(entry.newValue)}</dd>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function ItemHistory(props: ItemHistoryProps) {
  // Reset loading and results when the selected item changes.
  return (
    <HistoryContent
      key={JSON.stringify([props.boardId, props.itemId])}
      {...props}
    />
  )
}