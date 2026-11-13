import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import type { ActionItem } from '../services/actionItemService'
import type { ItemInput, Section } from '../services/workspaceService'
import type { PriorityLevel } from '../services/priorityService'
import { displayTarget, targetFromInput, type TargetDisplay } from '../target'
import StatusChooser from './StatusChooser'
import WorkspaceDialog from './WorkspaceDialog'

type Field = 'title' | 'owners' | 'target' | 'priority' | 'hardDate'
type Update = Partial<Omit<ItemInput, 'section'>>
type Props = {
  item: ActionItem
  boardId: string
  sections: Section[]
  sectionItems: ActionItem[]
  allItems: ActionItem[]
  externalOwnerSuggestions: string[]
  priorities: PriorityLevel[]
  statuses: string[]
  moving: boolean
  onUpdate: (update: Update) => Promise<void>
  onStatus: (status: string) => Promise<void>
  onMove: (sectionId: string, beforeId: number | null) => Promise<void>
  onDragOver: (event: DragEvent<HTMLTableRowElement>) => void
  onDrop: (event: DragEvent<HTMLTableRowElement>) => void
  onDragEnd: () => void
  dropBefore: boolean
}

function FieldEditor({
  item,
  field,
  priorities,
  externalOwnerSuggestions,
  onSave,
  onClose,
}: {
  item: ActionItem
  field: Field
  priorities: PriorityLevel[]
  externalOwnerSuggestions: string[]
  onSave: (update: Update) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState(
    field === 'title'
      ? item.title
      : field === 'hardDate'
        ? (item.hardDate ?? '')
        : item.priority,
  )
  const [target, setTarget] = useState<TargetDisplay>(
    displayTarget(item.target),
  )
  const [owners, setOwners] = useState(item.owners.map((o) => ({ ...o })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save(event?: FormEvent) {
    event?.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)
    try {
      const update: Update =
        field === 'target'
          ? {
              target: targetFromInput(
                target.type,
                target.value,
              ) as TargetDisplay,
            }
          : field === 'owners'
            ? {
                owners: owners
                  .filter((o) => o.name.trim())
                  .map((o) => ({ ...o, name: o.name.trim() })),
              }
            : field === 'hardDate'
              ? { hardDate: text || null }
              : { [field]: text }
      await onSave(update)
      onClose()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to save. Try again.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form
      className="max-cell-editor"
      onSubmit={(event) => void save(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) {
          event.preventDefault()
          onClose()
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          void save()
        }
      }}
    >
      <fieldset disabled={saving}>
        {field === 'target' ? (
          <>
            <label>
              Target type for {item.title}
              <select
                aria-label={`Target type for ${item.title}`}
                value={target.type}
                onChange={(e) =>
                  setTarget({
                    type: e.target.value as TargetDisplay['type'],
                    value: '',
                  })
                }
              >
                <option value="text">Text</option>
                <option value="date">Date</option>
              </select>
            </label>
            <label>
              Target for {item.title}
              {target.type === 'date' ? (
                <input
                  autoFocus
                  type="date"
                  value={target.value}
                  onChange={(e) =>
                    setTarget({ ...target, value: e.target.value })
                  }
                />
              ) : (
                <textarea
                  autoFocus
                  value={target.value}
                  rows={2}
                  onChange={(e) =>
                    setTarget({ ...target, value: e.target.value })
                  }
                />
              )}
            </label>
            <small>Ctrl+Enter saves. Escape cancels.</small>
          </>
        ) : field === 'owners' ? (
          <>
            
            {owners.map((owner, index) => (
  <div className="max-owner-row" key={index}>
    <input
      autoFocus={index === 0}
      aria-label={`Owner ${index + 1} for ${item.title}`}
      maxLength={200}
      list={`external-owner-suggestions-${item.id}`}
      value={owner.name}
      onChange={(e) =>
        setOwners((current) =>
          current.map((o, i) =>
            i === index ? { ...o, name: e.target.value } : o,
          ),
        )
      }
    />

    <label className="max-check">
      <input
        type="checkbox"
        checked={owner.isExternal}
        onChange={(e) =>
          setOwners((current) =>
            current.map((o, i) =>
              i === index
                ? { ...o, isExternal: e.target.checked }
                : o,
            ),
          )
        }
      />
      External
    </label>

    <button
      type="button"
      onClick={() =>
        setOwners((current) =>
          current.filter((_, i) => i !== index),
        )
      }
      aria-label={`Remove owner ${index + 1}`}
    >
      ×
    </button>
  </div>
))}

<datalist id={`external-owner-suggestions-${item.id}`}>
  {externalOwnerSuggestions.map((name) => (
    <option key={name} value={name} />
  ))}
</datalist>

<button
  type="button"
  autoFocus={!owners.length}
  onClick={() =>
    setOwners((current) => [
      ...current,
      { name: '', isExternal: true },
    ])
  }
>
  + Add owner
</button>

              
          </>
        ) : field === 'priority' ? (
          <label>
            Priority for {item.title}
            <select
              aria-label={`Priority for ${item.title}`}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
            >
              {priorities.map((level) => (
                <option key={level.name}>{level.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {field === 'title' ? 'Title' : 'Hard date'} for {item.title}
            <input
              autoFocus
              type={field === 'hardDate' ? 'date' : 'text'}
              value={text}
              required={field === 'title'}
              maxLength={field === 'title' ? 2000 : undefined}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="max-error">
          {error}
        </p>
      )}
      <div className="max-editor-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : error ? 'Retry save' : 'Save'}
        </button>
        <button type="button" disabled={saving} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function BoardItemRow({
  item,
  boardId,
  sections,
  sectionItems,
  allItems,
  externalOwnerSuggestions,
  priorities,
  statuses,
  moving,
  onUpdate,
  onStatus,
  onMove,
  onDragOver,
  onDrop,
  onDragEnd,
  dropBefore,
}: Props) {
  const [editing, setEditing] = useState<Field | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const currentSection = sections.find(
    (s) => s.name === (item.section.trim() || 'General'),
  )
  const [destination, setDestination] = useState(currentSection?.id ?? '')
  const [before, setBefore] = useState('')
  const [error, setError] = useState('')
  const [savingAttention, setSavingAttention] = useState(false)
  const [pendingAttention, setPendingAttention] = useState<boolean | null>(null)
  const [retryAttention, setRetryAttention] = useState<boolean | null>(null)
  const moveButton = useRef<HTMLButtonElement>(null)
  const currentIndex = sectionItems.findIndex((entry) => entry.id === item.id)
  function closeEditor(field: Field) {
    setEditing(null)
    requestAnimationFrame(() =>
      document.getElementById(`edit-${item.id}-${field}`)?.focus(),
    )
  }
  function cell(field: Field, content: React.ReactNode) {
    return editing === field ? (
      <FieldEditor
        key={field}
        item={item}
        field={field}
        priorities={priorities}
        externalOwnerSuggestions={externalOwnerSuggestions}
        onSave={onUpdate}
        onClose={() => closeEditor(field)}
      />
    ) : (
      <button
        id={`edit-${item.id}-${field}`}
        type="button"
        className={`max-cell-button max-${field === 'priority' ? 'priority-button' : field}`}
        aria-label={`Edit ${field === 'hardDate' ? 'hard date' : field} for ${item.title}`}
        onClick={() => setEditing(field)}
      >
        {content}
      </button>
    )
  }
  async function attention(value: boolean) {
    setSavingAttention(true)
    setPendingAttention(value)
    setError('')
    setRetryAttention(null)
    try {
      await onUpdate({ attention: value })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to save attention.',
      )
      setRetryAttention(value)
    } finally {
      setSavingAttention(false)
      setPendingAttention(null)
    }
  }
  async function move(sectionId: string, beforeId: number | null) {
    setError('')
    try {
      await onMove(sectionId, beforeId)
      setMoveOpen(false)
      requestAnimationFrame(() => moveButton.current?.focus())
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to move item. Try again.',
      )
    }
  }
  const target = displayTarget(item.target)
  return (
    <tr
      className={[
        item.status === 'Complete' ? 'max-complete' : '',
        dropBefore ? 'max-drop-before' : '',
      ].join(' ')}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <td className="max-handle-cell">
        <button
          ref={moveButton}
          type="button"
          className="max-drag-handle"
          draggable={!moving && !editing}
          aria-label={`Move ${item.title}`}
          title="Move item. Alt+Up or Alt+Down reorders within its section."
          disabled={moving}
          onClick={() => {
            setDestination(currentSection?.id ?? '')
            setBefore('')
            setError('')
            setMoveOpen(true)
          }}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(
              'application/x-flint-item',
              JSON.stringify({ boardId, itemId: item.id }),
            )
          }}
          onDragEnd={onDragEnd}
          onKeyDown={(event) => {
            if (!event.altKey || !currentSection || moving) return
            if (event.key === 'ArrowUp' && currentIndex > 0) {
              event.preventDefault()
              void move(currentSection.id, sectionItems[currentIndex - 1].id)
            }
            if (
              event.key === 'ArrowDown' &&
              currentIndex < sectionItems.length - 1
            ) {
              event.preventDefault()
              void move(
                currentSection.id,
                sectionItems[currentIndex + 2]?.id ?? null,
              )
            }
          }}
        >
          ⠿
        </button>
        {moveOpen && (
          <WorkspaceDialog
            title={`Move ${item.title}`}
            busy={moving}
            onClose={() => setMoveOpen(false)}
          >
            <form
              className="max-form"
              onSubmit={(event) => {
                event.preventDefault()
                void move(destination, before ? Number(before) : null)
              }}
            >
              <label>
                Destination section
                <select
                  aria-label="Destination section"
                  autoFocus
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value)
                    setBefore('')
                  }}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <select
                  aria-label="Position"
                  value={before}
                  onChange={(e) => setBefore(e.target.value)}
                >
                  <option value="">End of section</option>
                  {allItems
                    .filter(
                      (entry) =>
                        entry.id !== item.id &&
                        (entry.section.trim() || 'General') ===
                          sections.find((s) => s.id === destination)?.name,
                    )
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        Before {entry.title}
                      </option>
                    ))}
                </select>
              </label>
              {error && (
                <p role="alert" className="max-error">
                  {error}
                </p>
              )}
              <div className="max-dialog-actions">
                <button
                  type="button"
                  disabled={moving}
                  onClick={() => setMoveOpen(false)}
                >
                  Cancel
                </button>
                <button className="max-primary" type="submit" disabled={moving}>
                  {moving ? 'Moving…' : 'Move item'}
                </button>
              </div>
            </form>
          </WorkspaceDialog>
        )}
      </td>
      <td className="max-title-cell">{cell('title', item.title)}</td>
      <td>
        {cell(
          'owners',
          item.owners.length
            ? item.owners.map((owner, index) => (
                <span key={index}>
                  {index > 0 && ' / '}
                  {owner.name}
                  {owner.isExternal && ' (external)'}
                </span>
              ))
            : 'Assign owners',
        )}
      </td>
      <td>
        {cell(
          'target',
          <span className="max-target-text">
            {target.value || 'Set target'}
          </span>,
        )}
        {cell(
          'hardDate',
          item.hardDate ? (
            <small>Hard date: {item.hardDate}</small>
          ) : (
            <small>+ Hard date</small>
          ),
        )}
      </td>
      <td>
        <StatusChooser
          itemTitle={item.title}
          status={item.status}
          statuses={statuses}
          onChange={onStatus}
        />
      </td>
      <td>
        {cell(
          'priority',
          <span
            className={`max-priority max-priority-${item.priority.toLowerCase()}`}
          >
            <span aria-hidden="true" />
            {item.priority}
          </span>,
        )}
      </td>
      <td>
        <input
          className="max-attention"
          type="checkbox"
          checked={pendingAttention ?? item.attention}
          disabled={savingAttention}
          onChange={(e) => void attention(e.target.checked)}
          aria-label={`Attention for ${item.title}`}
        />
        {!moveOpen && error && (
          <p role="alert" className="max-error">
            {error}
          </p>
        )}
        {retryAttention !== null && (
          <button type="button" onClick={() => void attention(retryAttention)}>
            Retry attention
          </button>
        )}
      </td>
    </tr>
  )
}
