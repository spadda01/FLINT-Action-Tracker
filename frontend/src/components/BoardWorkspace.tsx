import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react'
import { loadActionItems, type ActionItem } from '../services/actionItemService'
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
import { dateFirstSorting, displayTarget } from '../target'
import BoardItemDialog from './BoardItemDialog'
import BoardItemRow from './BoardItemRow'
import WorkspaceDialog from './WorkspaceDialog'
import './BoardWorkspace.css'

type Filter = { attention: boolean; priority: string; sort: string }
const EMPTY_FILTER: Filter = { attention: false, priority: '', sort: '' }

export default function BoardWorkspace({ boardId }: { boardId: string }) {
  const [items, setItems] = useState<ActionItem[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [priorities, setPriorities] = useState<PriorityLevel[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
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
  const [collapsed, setCollapsed] = useState<string[]>([])
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
  const quickInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const movePending = useRef(false)
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

  const externalOwnerSuggestions = useMemo(() => {
  const names = items
    .flatMap((item) => item.owners)
    .filter((owner) => owner.isExternal)
    .map((owner) => owner.name.trim())
    .filter(Boolean)

  return [...new Set(names)]
}, [items])
  
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const selected = items.filter(
      (item) =>
        (!filters.attention || item.attention) &&
        (!filters.priority || item.priority === filters.priority) &&
        (!query ||
          [
            item.title,
            item.section,
            ...item.owners.map((owner) => owner.name),
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
  }, [items, search, filters, priorities])
  const orderingRestricted =
    !!search.trim() || filters.attention || !!filters.priority || !!filters.sort

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
          {filters.attention || filters.priority || filters.sort ? ' •' : ''}
        </button>
        <button
          type="button"
          className="max-primary max-add-button"
          onClick={() => setAdding(true)}
        >
          + Add item
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
                onClick={() =>
                  setCollapsed((current) =>
                    isCollapsed
                      ? current.filter((id) => id !== section.id)
                      : [...current, section.id],
                  )
                }
              >
                <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>{' '}
                {section.name}
              </button>
              <span className="max-section-count">
                {rows.length} of {sectionItems.length}{' '}
                {sectionItems.length === 1 ? 'item' : 'items'}
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
                        moving={moving || orderingRestricted}
                        onUpdate={(changes) => update(item, changes)}
                        onStatus={(next) => status(item, next)}
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
