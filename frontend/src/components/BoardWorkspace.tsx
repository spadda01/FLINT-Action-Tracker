import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type DragEvent,
    type FormEvent,
} from 'react'
import {
    archiveActionItem,
    loadActionItems,
    loadArchivedActionItems,
    restoreActionItem,
    type ActionItem,
    type ArchivedActionItem,
} from '../services/actionItemService'

import {
    loadOrganizations,
    organizationName,
    type OrganizationsState,
} from '../services/organizationService'
import { getPriorities, type PriorityLevel } from '../services/priorityService'
import {
    changeItemStatus,
    loadBoardStatuses,
} from '../services/itemStatusService'
import {
    announceActionItemCreated,
    announcePriorityUpdate,
    subscribeToPriorityUpdates,
} from '../services/priorityEvents'
import {
    createItem,
    createSection,
    loadSections,
    moveItem,
    orderSections,
    renameSection,
    updateItem,
    type ItemInput,
    type Section,
} from '../services/workspaceService'
import { useInactiveEmployees } from '../services/useInactiveEmployees'
import { readCollapsedSections, saveCollapsedSections } from '../services/sectionCollapse'
import { dateFirstSorting, displayTarget } from '../target'
import BoardItemDialog from './BoardItemDialog'
import BoardItemRow from './BoardItemRow'
import { getOwnerType } from '../services/ownerTypes'
import WorkspaceDialog from './WorkspaceDialog'
import './BoardWorkspace.css'

type Filter = {
    attention: boolean
    hideCompleted: boolean
    priority: string
    ownerType: string
    sort: string
}
const EMPTY_FILTER: Filter = {
    attention: false,
    hideCompleted: false,
    priority: '',
    ownerType: '',
    sort: '',
}

export default function BoardWorkspace({ boardId, userId }: { boardId: string; userId: string }) {
    const [items, setItems] = useState<ActionItem[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [priorities, setPriorities] = useState<PriorityLevel[]>([])
    const [statuses, setStatuses] = useState<string[]>([])
    const [organizations, setOrganizations] = useState<OrganizationsState>({
        status: 'loading',
        organizations: [],
    })
    const [organizationAttempt, setOrganizationAttempt] = useState(0)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [attempt, setAttempt] = useState(0)
    const [search, setSearch] = useState('')
    const [filters, setFilters] = useState<Filter>(EMPTY_FILTER)
    const [filterDraft, setFilterDraft] = useState<Filter>(EMPTY_FILTER)
    const [filterOpen, setFilterOpen] = useState(false)
    const [adding, setAdding] = useState(false)
    const [sectionEditor, setSectionEditor] = useState<Section | 'new' | null>(
        null,
    )
    const [sectionName, setSectionName] = useState('')
    const [sectionError, setSectionError] = useState('')
    const [sectionSaving, setSectionSaving] = useState(false)
    const [collapsed, setCollapsed] = useState(() => readCollapsedSections(userId, boardId))
    const [collapseSaveFailed, setCollapseSaveFailed] = useState(false)
    const [moving, setMoving] = useState(false)
    const [moveError, setMoveError] = useState('')
    const [moveRetry, setMoveRetry] = useState<{
        itemId: number
        sectionId: string
        beforeId: number | null
    } | null>(null)
    const [dropBefore, setDropBefore] = useState<number | null>(null)
    const [notice, setNotice] = useState('')
    const [quickTitles, setQuickTitles] = useState<Record<string, string>>({})
    const [quickError, setQuickError] = useState<Record<string, string>>({})
    const [quickSaving, setQuickSaving] = useState<string[]>([])
    const [archivedItems, setArchivedItems] = useState<ArchivedActionItem[]>([])
    const [canRestore, setCanRestore] = useState(false)
    const [archivedLoaded, setArchivedLoaded] = useState(false)
    const [archivedLoading, setArchivedLoading] = useState(false)
    const [archivedOpen, setArchivedOpen] = useState(false)
    const [archivedLoadError, setArchivedLoadError] = useState('')
    const [archiveError, setArchiveError] = useState('')
    const [restoringIds, setRestoringIds] = useState<number[]>([])
    const quickInputs = useRef<Record<string, HTMLInputElement | null>>({})
    const movePending = useRef(false)
    const inactiveEmployeeIds = useInactiveEmployees(boardId, items)
    useEffect(() => {
        let active = true
        setLoading(true)
        setLoadError('')
        void Promise.all([
            loadActionItems(boardId),
            loadSections(boardId),
            getPriorities(),
            loadBoardStatuses(boardId),
        ])
            .then(([nextItems, nextSections, nextPriorities, nextStatuses]) => {
                if (!active) return
                setItems(nextItems)
                setSections(nextSections)
                setPriorities(nextPriorities)
                setStatuses(nextStatuses)
            })
            .catch(() => {
                if (active)
                    setLoadError('Unable to load this board workspace. Please try again.')
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [boardId, attempt])
    // The organization list loads separately so a failure never blocks the board.
    useEffect(() => {
        let active = true
        setOrganizations((current) => ({ ...current, status: 'loading' }))
        loadOrganizations()
            .then((list) => {
                if (active) setOrganizations({ status: 'ready', organizations: list })
            })
            .catch(() => {
                if (active) setOrganizations({ status: 'error', organizations: [] })
            })
        return () => {
            active = false
        }
    }, [organizationAttempt])
    useEffect(
        () =>
            subscribeToPriorityUpdates(({ boardId: id, itemId, priority }) => {
                if (id === boardId)
                    setItems((current) =>
                        current.map((item) =>
                            item.id === itemId ? { ...item, priority } : item,
                        ),
                    )
            }),
        [boardId],
    )

    // Suggest distinct free-text external owners already assigned on this board.
    const externalOwnerSuggestions = useMemo(() => {
        const names = items
            .flatMap((item) => item.owners)
            .filter((owner) => owner.isExternal && !owner.organizationId)
            .map((owner) => owner.name.trim())
            .filter(Boolean)
        return [...new Set(names)]
    }, [items])

    const visibleItems = useMemo(() => {
        const query = search.trim().toLowerCase()
        const selected = items.filter(
            (item) =>
                (!filters.attention || item.attention) &&
                (!filters.hideCompleted || item.status !== 'Complete') &&
                (!filters.priority || item.priority === filters.priority) &&
                (!filters.ownerType || item.owners.some((owner) => getOwnerType(owner) === filters.ownerType)) &&
                (!query ||
                    [
                        item.title,
                        item.section,
                        ...item.owners.flatMap((owner) => [
                            owner.name,
                            organizationName(organizations.organizations, owner.organizationId) ??
                            '',
                        ]),
                        displayTarget(item.target).value,
                    ].some((value) => value.toLowerCase().includes(query))),
        )
        if (filters.sort === 'target')
            return [...selected].sort((a, b) => {
                const [ag, av] = dateFirstSorting(displayTarget(a.target)),
                    [bg, bv] = dateFirstSorting(displayTarget(b.target))
                return ag - bg || av.localeCompare(bv)
            })
        if (filters.sort === 'priority')
            return [...selected].sort(
                (a, b) =>
                    (priorities.find((p) => p.name === a.priority)?.rank ?? 999) -
                    (priorities.find((p) => p.name === b.priority)?.rank ?? 999),
            )
        return selected
    }, [items, search, filters, priorities, organizations.organizations])
    const orderingRestricted =
        !!search.trim() ||
        filters.attention ||
        filters.hideCompleted ||
        !!filters.priority ||
        !!filters.ownerType ||
        !!filters.sort

    async function update(
        item: ActionItem,
        changes: Partial<Omit<ItemInput, 'section'>>,
    ) {
        const saved = await updateItem(boardId, item.id, changes)
        // Merge only the edited fields, so parallel saves in other cells stay intact.
        setItems((current) =>
            current.map((entry) =>
                entry.id === item.id
                    ? {
                        ...entry,
                        ...Object.fromEntries(
                            Object.keys(changes).map((key) => [
                                key,
                                saved[key as keyof ActionItem],
                            ]),
                        ),
                    }
                    : entry,
            ),
        )
        if (changes.priority)
            announcePriorityUpdate({
                boardId,
                itemId: item.id,
                priority: saved.priority,
            })
    }
    async function status(item: ActionItem, next: string) {
        const result = await changeItemStatus(boardId, item.id, next)
        setItems((current) =>
            current.map((entry) =>
                entry.id === item.id ? { ...entry, status: result.item.status } : entry,
            ),
        )
        // Errors intentionally reach StatusChooser, which preserves its Retry state.
    }
    async function archive(itemId: number, reason: string) {
        await archiveActionItem(boardId, itemId, reason)
        setItems((current) => current.filter((item) => item.id !== itemId))
        setArchivedLoaded(false)
        setNotice('Item archived. Its history is retained.')
    }
    async function loadArchived() {
        setArchivedLoading(true)
        setArchivedLoadError('')
        try {
            const response = await loadArchivedActionItems(boardId)
            setArchivedItems(response.archivedItems)
            setCanRestore(response.canRestore)
            setArchivedLoaded(true)
        } catch (cause) {
            setArchivedLoadError(
                cause instanceof Error
                    ? cause.message
                    : 'Unable to load archived items. Try again.',
            )
        } finally {
            setArchivedLoading(false)
        }
    }
    async function restore(itemId: number) {
        if (restoringIds.includes(itemId)) return
        setRestoringIds((current) => [...current, itemId])
        setArchiveError('')
        try {
            const restored = await restoreActionItem(boardId, itemId)
            setItems((current) => [...current, restored])
            setArchivedItems((current) =>
                current.filter((record) => record.item.id !== itemId),
            )
            setNotice('Item restored.')
        } catch (cause) {
            setArchiveError(
                cause instanceof Error
                    ? cause.message
                    : 'Unable to restore item. Try again.',
            )
        } finally {
            setRestoringIds((current) => current.filter((id) => id !== itemId))
        }
    }
    async function move(
        itemId: number,
        sectionId: string,
        beforeId: number | null,
    ) {
        if (movePending.current)
            throw new Error('Another move is saving. Try again in a moment.')
        if (orderingRestricted)
            throw new Error('Clear search, filters and sorting before moving items.')
        movePending.current = true
        setMoving(true)
        setMoveError('')
        setMoveRetry(null)
        try {
            const saved = await moveItem(boardId, itemId, sectionId, beforeId)
            // Apply the saved order/section without overwriting concurrent field saves.
            setItems((current) => [
                ...saved.map((entry) => ({
                    ...(current.find((item) => item.id === entry.id) ?? entry),
                    section: entry.section,
                })),
                ...current.filter(
                    (entry) => !saved.some((item) => item.id === entry.id),
                ),
            ])
            setNotice('Item moved and saved.')
        } catch (cause) {
            setMoveRetry({ itemId, sectionId, beforeId })
            throw cause
        } finally {
            movePending.current = false
            setMoving(false)
            setDropBefore(null)
        }
    }
    function dragged(event: DragEvent): number | null {
        try {
            const payload = JSON.parse(
                event.dataTransfer.getData('application/x-flint-item'),
            )
            return payload.boardId === boardId && Number.isInteger(payload.itemId)
                ? payload.itemId
                : null
        } catch {
            return null
        }
    }
    function dragOver(event: DragEvent, beforeId: number | null) {
        if (
            orderingRestricted ||
            moving ||
            !Array.from(event.dataTransfer.types).includes('application/x-flint-item')
        )
            return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        setDropBefore(beforeId)
    }
    function drop(event: DragEvent, sectionId: string, beforeId: number | null) {
        event.preventDefault()
        event.stopPropagation()
        setDropBefore(null)
        const id = dragged(event)
        if (id !== null)
            void move(id, sectionId, beforeId).catch((cause) =>
                setMoveError(
                    cause instanceof Error ? cause.message : 'Unable to move. Try again.',
                ),
            )
    }
    async function quickAdd(event: FormEvent, section: Section) {
        event.preventDefault()
        const title = quickTitles[section.id]?.trim()
        if (!title || quickSaving.includes(section.id)) {
            if (!title)
                setQuickError((current) => ({
                    ...current,
                    [section.id]: 'Enter an action item title.',
                }))
            return
        }
        setQuickSaving((current) => [...current, section.id])
        setQuickError((current) => ({ ...current, [section.id]: '' }))
        try {
            const saved = await createItem(boardId, { title, section: section.name })
            setItems((current) => [...current, saved])
            setQuickTitles((current) => ({ ...current, [section.id]: '' }))
            announceActionItemCreated({ boardId })
            setNotice('Action item added.')
        } catch (cause) {
            setQuickError((current) => ({
                ...current,
                [section.id]:
                    cause instanceof Error ? cause.message : 'Unable to add. Try again.',
            }))
        } finally {
            setQuickSaving((current) => current.filter((id) => id !== section.id))
            requestAnimationFrame(() => quickInputs.current[section.id]?.focus())
        }
    }
    async function saveSection(event: FormEvent) {
        event.preventDefault()
        if (!sectionName.trim() || !sectionEditor) return
        setSectionSaving(true)
        setSectionError('')
        try {
            if (sectionEditor === 'new') {
                const added = await createSection(boardId, sectionName)
                setSections((current) => [...current, added])
            } else {
                const original = sectionEditor
                const renamed = await renameSection(boardId, original.id, sectionName)
                setSections((current) =>
                    current.map((s) => (s.id === renamed.id ? renamed : s)),
                )
                setItems((current) =>
                    current.map((item) =>
                        (item.section.trim() || 'General') === original.name
                            ? { ...item, section: renamed.name }
                            : item,
                    ),
                )
            }
            setSectionEditor(null)
            setNotice('Section saved.')
        } catch (cause) {
            setSectionError(
                cause instanceof Error
                    ? cause.message
                    : 'Unable to save section. Try again.',
            )
        } finally {
            setSectionSaving(false)
        }
    }
    async function shiftSection(index: number, direction: number) {
        if (moving) return
        const next = [...sections]
            ;[next[index], next[index + direction]] = [
                next[index + direction],
                next[index],
            ]
        setMoving(true)
        setMoveError('')
        try {
            setSections(
                await orderSections(
                    boardId,
                    next.map((s) => s.id),
                ),
            )
            setNotice('Section order saved.')
        } catch (cause) {
            setMoveError(
                cause instanceof Error
                    ? cause.message
                    : 'Unable to reorder sections. Try again.',
            )
        } finally {
            setMoving(false)
        }
    }
    function toggleSection(sectionId: string) {
        const next = collapsed.includes(sectionId)
            ? collapsed.filter((id) => id !== sectionId)
            : [...collapsed, sectionId]
        setCollapsed(next)
        setCollapseSaveFailed(!saveCollapsedSections(userId, boardId, next))
    }

    if (loading) return <p role="status">Loading action items...</p>
    if (loadError)
        return (
            <section className="boards-error">
                <p role="alert">{loadError}</p>
                <button
                    className="boards-retry"
                    onClick={() => setAttempt((value) => value + 1)}
                >
                    Retry loading workspace
                </button>
            </section>
        )
    return (
        <section className="max-workspace" aria-label="Action items workspace">
            <div className="max-toolbar">
                <label className="max-search">
                    <span className="visually-hidden">Search action items</span>
                    <input
                        type="search"
                        placeholder="Search items…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <button
                    type="button"
                    className="max-filter-button"
                    onClick={() => {
                        setFilterDraft(filters)
                        setFilterOpen(true)
                    }}
                >
                    Filters
                    {filters.attention ||
                        filters.hideCompleted ||
                        filters.priority ||
                        filters.ownerType ||
                        filters.sort
                        ? ' •'
                        : ''}
                </button>
                <button
                    type="button"
                    className="max-primary max-add-button"
                    onClick={() => setAdding(true)}
                >
                    + Add item
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setArchiveError('')
                        setArchivedOpen(true)
                        if (!archivedLoaded) void loadArchived()
                    }}
                >
                    Archived items
                </button>
            </div>
            {orderingRestricted && (
                <p className="max-view-notice">
                    Search, filters or sorting are active.{' '}
                    <button
                        type="button"
                        onClick={() => {
                            setSearch('')
                            setFilters(EMPTY_FILTER)
                        }}
                    >
                        Clear view to move items
                    </button>
                </p>
            )}
            {archivedOpen && (
                <WorkspaceDialog
                    title="Archived items"
                    busy={archivedLoading}
                    onClose={() => setArchivedOpen(false)}
                >
                    {archivedLoading ? (
                        <p role="status">Loading archived items…</p>
                    ) : archivedLoadError ? (
                        <>
                            <p role="alert" className="max-error">
                                {archivedLoadError}
                            </p>
                            <button type="button" onClick={() => void loadArchived()}>
                                Retry loading archived items
                            </button>
                        </>
                    ) : archivedItems.length === 0 ? (
                        <p>No archived items.</p>
                    ) : (
                        <>
                            {!canRestore && (
                                <p className="max-muted">
                                    Only a board admin can restore archived items.
                                </p>
                            )}
                            {archivedItems.map((record) => (
                                <article className="max-archived-item" key={record.item.id}>
                                    <h3>{record.item.title}</h3>
                                    <p>
                                        <strong>Reason:</strong> {record.reason}
                                    </p>
                                    <p className="max-muted">
                                        Archived by {record.archivedBy} on{' '}
                                        {new Date(record.archivedAt).toLocaleString()}
                                    </p>
                                    {canRestore && (
                                        <button
                                            type="button"
                                            disabled={restoringIds.includes(record.item.id)}
                                            onClick={() => void restore(record.item.id)}
                                        >
                                            {restoringIds.includes(record.item.id)
                                                ? 'Restoring…'
                                                : 'Restore'}
                                        </button>
                                    )}
                                </article>
                            ))}
                        </>
                    )}
                    {archiveError && (
                        <p role="alert" className="max-error">
                            {archiveError}
                        </p>
                    )}
                </WorkspaceDialog>
            )}
            {moveError && (
                <p role="alert" className="max-error">
                    {moveError}{' '}
                    {moveRetry && (
                        <button
                            onClick={() =>
                                void move(
                                    moveRetry.itemId,
                                    moveRetry.sectionId,
                                    moveRetry.beforeId,
                                ).catch((cause) => setMoveError(cause.message))
                            }
                        >
                            Retry move
                        </button>
                    )}
                </p>
            )}
            <span role="status" className="visually-hidden">
                {notice}
            </span>
            {items.length === 0 && (
                <p className="max-empty">
                    No action items found. Add the first item below.
                </p>
            )}
            {items.length > 0 && visibleItems.length === 0 && (
                <p className="max-empty" role="status">
                    No action items match your search or filter.
                </p>
            )}
            {collapseSaveFailed && (
                <p className="max-error" role="status">
                    Section preferences could not be saved. Your choices may reset when you reopen this board.
                </p>
            )}
            {sections.map((section, index) => {
                const rows = visibleItems.filter(
                    (item) => (item.section.trim() || 'General') === section.name,
                )
                const sectionItems = items.filter(
                    (item) => (item.section.trim() || 'General') === section.name,
                )
                const isCollapsed = collapsed.includes(section.id)
                return (
                    <section
                        className="max-section"
                        key={section.id}
                        aria-label={`${section.name} section`}
                    >
                        <div className="max-section-header">
                            <button
                                className="max-section-toggle"
                                type="button"
                                aria-expanded={!isCollapsed}
                                aria-controls={`section-${section.id}`}
                                aria-describedby={`section-count-${section.id}`}
                                onClick={() => toggleSection(section.id)}
                            >
                                <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>{' '}
                                {section.name}
                            </button>
                            <span className="max-section-count" id={`section-count-${section.id}`}>
                                <span>
                                    {rows.length} of {sectionItems.length}{' '}
                                    {sectionItems.length === 1 ? 'item' : 'items'}
                                </span>
                                {' · '}
                                <span>{sectionItems.filter((item) => item.attention).length} flagged for attention</span>
                            </span>
                            <div className="max-section-actions">
                                <button
                                    aria-label={`Rename ${section.name}`}
                                    type="button"
                                    disabled={moving}
                                    onClick={() => {
                                        setSectionName(section.name)
                                        setSectionError('')
                                        setSectionEditor(section)
                                    }}
                                >
                                    Rename
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Move ${section.name} section up`}
                                    disabled={index === 0 || moving}
                                    onClick={() => void shiftSection(index, -1)}
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Move ${section.name} section down`}
                                    disabled={index === sections.length - 1 || moving}
                                    onClick={() => void shiftSection(index, 1)}
                                >
                                    ↓
                                </button>
                            </div>
                        </div>
                        <div
                            id={`section-${section.id}`}
                            hidden={isCollapsed}
                            className="max-section-body"
                            onDragOver={(event) => dragOver(event, null)}
                            onDrop={(event) => drop(event, section.id, null)}
                        >
                            <div
                                className="max-table-scroll"
                                tabIndex={0}
                                aria-label={`Scroll ${section.name} table`}
                            >
                                <table
                                    className="max-table"
                                    aria-label={`${section.name} action items`}
                                >
                                    <thead>
                                        <tr>
                                            <th scope="col" className="max-handle-cell">
                                                <span className="visually-hidden">Move</span>
                                            </th>
                                            <th scope="col">Item</th>
                                            <th scope="col">Owners</th>
                                            <th scope="col">Target</th>
                                            <th scope="col">Status</th>
                                            <th scope="col">Priority</th>
                                            <th scope="col">Attention</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="max-empty">
                                                    {sectionItems.length
                                                        ? 'No matching items'
                                                        : 'No items — drag an item here or add one below.'}
                                                </td>
                                            </tr>
                                        )}
                                        {rows.map((item) => (
                                            <BoardItemRow
                                                key={item.id}
                                                item={item}
                                                boardId={boardId}
                                                sections={sections}
                                                sectionItems={orderingRestricted ? [] : sectionItems}
                                                allItems={items}
                                                externalOwnerSuggestions={externalOwnerSuggestions}
                                                priorities={priorities}
                                                statuses={statuses}
                                                organizations={organizations}
                                                onRetryOrganizations={() =>
                                                    setOrganizationAttempt((n) => n + 1)
                                                }
                                                inactiveEmployeeIds={inactiveEmployeeIds}
                                                moving={moving || orderingRestricted}
                                                onUpdate={(changes) => update(item, changes)}
                                                onStatus={(next) => status(item, next)}
                                                onArchive={(reason) => archive(item.id, reason)}
                                                onMove={(sid, before) => move(item.id, sid, before)}
                                                onDragEnd={() => setDropBefore(null)}
                                                dropBefore={dropBefore === item.id}
                                                onDragOver={(event) => dragOver(event, item.id)}
                                                onDrop={(event) => drop(event, section.id, item.id)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <form
                                className="max-quick-entry"
                                onSubmit={(event) => void quickAdd(event, section)}
                            >
                                <label
                                    className="visually-hidden"
                                    htmlFor={`quick-${section.id}`}
                                >
                                    New action item in {section.name}
                                </label>
                                <input
                                    id={`quick-${section.id}`}
                                    ref={(element) => {
                                        quickInputs.current[section.id] = element
                                    }}
                                    value={quickTitles[section.id] ?? ''}
                                    readOnly={quickSaving.includes(section.id)}
                                    placeholder="+ Add an action item and press Enter"
                                    onChange={(event) =>
                                        setQuickTitles((current) => ({
                                            ...current,
                                            [section.id]: event.target.value,
                                        }))
                                    }
                                />
                                <button
                                    type="submit"
                                    disabled={quickSaving.includes(section.id)}
                                >
                                    {quickSaving.includes(section.id) ? 'Adding…' : 'Add'}
                                </button>
                                {quickError[section.id] && (
                                    <p role="alert" className="max-error">
                                        {quickError[section.id]}
                                    </p>
                                )}
                            </form>
                        </div>
                    </section>
                )
            })}
            <button
                type="button"
                className="max-add-section"
                onClick={() => {
                    setSectionName('')
                    setSectionError('')
                    setSectionEditor('new')
                }}
            >
                + Add section
            </button>
            {adding && (
                <BoardItemDialog
                    sections={sections}
                    priorities={priorities}
                    statuses={statuses}
                    organizations={organizations}
                    onRetryOrganizations={() => setOrganizationAttempt((n) => n + 1)}
                    onClose={() => setAdding(false)}
                    onSave={async (input) => {
                        const saved = await createItem(boardId, input)
                        setItems((current) => [...current, saved])
                        setAdding(false)
                        setNotice('Action item added.')
                        announceActionItemCreated({ boardId })
                    }}
                />
            )}
            {filterOpen && (
                <WorkspaceDialog
                    title="Filter items"
                    onClose={() => setFilterOpen(false)}
                >
                    <form
                        className="max-form"
                        onSubmit={(event) => {
                            event.preventDefault()
                            setFilters(filterDraft)
                            setFilterOpen(false)
                        }}
                    >
                        <label className="max-check">
                            <input
                                type="checkbox"
                                checked={filterDraft.attention}
                                onChange={(event) =>
                                    setFilterDraft((current) => ({
                                        ...current,
                                        attention: event.target.checked,
                                    }))
                                }
                            />
                            Attention items only
                        </label>
                        <p className="max-muted">Show items flagged for attention</p>
                        <label className="max-check">
                            <input
                                type="checkbox"
                                checked={filterDraft.hideCompleted}
                                onChange={(event) =>
                                    setFilterDraft((current) => ({
                                        ...current,
                                        hideCompleted: event.target.checked,
                                    }))
                                }
                            />
                            Hide completed
                        </label>
                        <p className="max-muted">
                            Keep completed items saved but hide them from this view
                        </p>
                        <label>
                            Priority
                            <select
                                aria-label="Priority"
                                value={filterDraft.priority}
                                onChange={(event) =>
                                    setFilterDraft((current) => ({
                                        ...current,
                                        priority: event.target.value,
                                    }))
                                }
                            >
                                <option value="">All priorities</option>
                                {priorities.map((priority) => (
                                    <option key={priority.name}>{priority.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Owner type
                            <select
                                aria-label="Owner type"
                                value={filterDraft.ownerType}
                                onChange={(event) =>
                                    setFilterDraft((current) => ({
                                        ...current,
                                        ownerType: event.target.value,
                                    }))
                                }
                            >
                                <option value="">All owner types</option>
                                <option value="staff">Staff</option>
                                <option value="external">Free-text external</option>
                                <option value="organization">Organization-backed</option>
                            </select>
                        </label>
                        <label>
                            Sort items
                            <select
                                aria-label="Sort items"
                                value={filterDraft.sort}
                                onChange={(event) =>
                                    setFilterDraft((current) => ({
                                        ...current,
                                        sort: event.target.value,
                                    }))
                                }
                            >
                                <option value="">Saved order</option>
                                <option value="target">Target: dates first</option>
                                <option value="priority">Priority: high to low</option>
                            </select>
                        </label>
                        <div className="max-dialog-actions">
                            <button
                                type="button"
                                onClick={() => {
                                    setFilterDraft(EMPTY_FILTER)
                                    setFilters(EMPTY_FILTER)
                                    setFilterOpen(false)
                                }}
                            >
                                Clear
                            </button>
                            <button className="max-primary" type="submit">
                                Apply
                            </button>
                        </div>
                    </form>
                </WorkspaceDialog>
            )}
            {sectionEditor && (
                <WorkspaceDialog
                    title={sectionEditor === 'new' ? 'Add section' : 'Rename section'}
                    busy={sectionSaving}
                    onClose={() => setSectionEditor(null)}
                >
                    <form
                        className="max-form"
                        onSubmit={(event) => void saveSection(event)}
                    >
                        <label>
                            Section name
                            <input
                                autoFocus
                                required
                                maxLength={200}
                                value={sectionName}
                                onChange={(event) => setSectionName(event.target.value)}
                            />
                        </label>
                        {sectionError && (
                            <p role="alert" className="max-error">
                                {sectionError}
                            </p>
                        )}
                        <div className="max-dialog-actions">
                            <button
                                type="button"
                                disabled={sectionSaving}
                                onClick={() => setSectionEditor(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="max-primary"
                                disabled={sectionSaving || !sectionName.trim()}
                                type="submit"
                            >
                                {sectionSaving ? 'Saving…' : 'Save section'}
                            </button>
                        </div>
                    </form>
                </WorkspaceDialog>
            )}
        </section>
    )
}
