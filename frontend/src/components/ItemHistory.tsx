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

type HistoryOwner = {
    name: string
    isExternal: boolean
    employeeId: string | null
    organizationId: string | null
}

function readHistoryOwners(value: JsonValue): HistoryOwner[] | null {
    if (!Array.isArray(value)) return null

    const owners: HistoryOwner[] = []

    for (const entry of value) {
        if (entry === null || Array.isArray(entry) || typeof entry !== 'object') {
            return null
        }

        if (typeof entry.name !== 'string' || typeof entry.isExternal !== 'boolean') {
            return null
        }

        const { employeeId, organizationId } = entry

        if (
            (employeeId != null && typeof employeeId !== 'string') ||
            (organizationId != null && typeof organizationId !== 'string')
        ) {
            return null
        }

        owners.push({
            name: entry.name,
            isExternal: entry.isExternal,
            employeeId: employeeId ?? null,
            organizationId: organizationId ?? null,
        })
    }

    return owners
}

function ownerHistoryKey(owner: HistoryOwner): string {
    if (owner.employeeId) {
        return `employee:${owner.employeeId}`
    }

    return `name:${owner.name.trim().toLocaleLowerCase()}`
}

function describeOwnerChanges(
    oldValue: JsonValue,
    newValue: JsonValue,
): string[] | null {
    const previous = readHistoryOwners(oldValue)
    const current = readHistoryOwners(newValue)

    // Older or unusual records retain the original history display.
    if (!previous || !current) return null

    const previousKeys = previous.map(ownerHistoryKey)
    const currentKeys = current.map(ownerHistoryKey)

    // Identical unlinked names can make comparisons ambiguous.
    if (
        new Set(previousKeys).size !== previousKeys.length ||
        new Set(currentKeys).size !== currentKeys.length
    ) {
        return null
    }

    const previousSet = new Set(previousKeys)
    const currentSet = new Set(currentKeys)
    const changes: string[] = []

    for (const owner of current) {
        if (!previousSet.has(ownerHistoryKey(owner))) {
            changes.push(`Owner added: ${owner.name}`)
        }
    }

    for (const owner of previous) {
        if (!currentSet.has(ownerHistoryKey(owner))) {
            changes.push(`Owner removed: ${owner.name}`)
        }
    }

    // compare details for owners present in both versions
    for (const owner of current) {
        const key = ownerHistoryKey(owner)
        const previousOwner = previous.find(
            (candidate) => ownerHistoryKey(candidate) === key,
        )

        if (!previousOwner) continue

        if (previousOwner.isExternal !== owner.isExternal) {
            changes.push(
                `${owner.name} changed to ${owner.isExternal ? 'External' : 'Staff'}`,
            )
        }

        if (previousOwner.organizationId !== owner.organizationId) {
            const organization = owner.organizationId ?? 'No organization'
            changes.push(`${owner.name} organization changed to ${organization}`)
        }
    }

    // compare the relative order of owners present in both lists
    const sharedPrevious = previousKeys.filter((key) => currentSet.has(key))
    const sharedCurrent = currentKeys.filter((key) => previousSet.has(key))

    if (sharedPrevious.join('\0') !== sharedCurrent.join('\0')) {
        const orderedNames = current
            .filter((owner) => previousSet.has(ownerHistoryKey(owner)))
            .map((owner) => owner.name)

        changes.push(`Owner order changed: ${orderedNames.join(' → ')}`)
    }

    return changes
}

function HistoryChangeDetails({ entry }: { entry: ItemHistoryEntry }) {
    const ownerChanges =
        entry.field === 'owners'
            ? describeOwnerChanges(entry.oldValue, entry.newValue)
            : null

    if (ownerChanges && ownerChanges.length > 0) {
        return (
            <ul className="item-history-owner-changes">
                {ownerChanges.map((change, index) => (
                    <li key={index}>{change}</li>
                ))}
            </ul>
        )
    }

    // Keep the original display for other fields and older history records.
    return (
        <dl>
            <dt>Previous value</dt>
            <dd>{formatValue(entry.oldValue)}</dd>
            <dt>New value</dt>
            <dd>{formatValue(entry.newValue)}</dd>
        </dl>
    )
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
                            <HistoryChangeDetails entry={entry} />
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