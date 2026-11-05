import { useState, type FormEvent } from 'react'
import WorkspaceDialog from './WorkspaceDialog'
import type { ItemInput, Section } from '../services/workspaceService'
import type { PriorityLevel } from '../services/priorityService'
import type { TargetDisplay } from '../target'

export default function BoardItemDialog({
  sections,
  priorities,
  statuses,
  onClose,
  onSave,
}: {
  sections: Section[]
  priorities: PriorityLevel[]
  statuses: string[]
  onClose: () => void
  onSave: (input: ItemInput) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [section, setSection] = useState(sections[0]?.name ?? 'General')
  const [owners, setOwners] = useState<{ name: string; isExternal: boolean }[]>(
    [],
  )
  const [target, setTarget] = useState<TargetDisplay>({
    type: 'text',
    value: '',
  })
  const [hardDate, setHardDate] = useState('')
  const [status, setStatus] = useState(
    statuses.includes('Open') ? 'Open' : statuses[0],
  )
  const [priority, setPriority] = useState(
    priorities.some((p) => p.name === 'Medium')
      ? 'Medium'
      : priorities[0]?.name,
  )
  const [attention, setAttention] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        title: title.trim(),
        section,
        owners: owners
          .filter((o) => o.name.trim())
          .map((o) => ({ ...o, name: o.name.trim() })),
        target,
        hardDate: hardDate || null,
        status,
        priority,
        attention,
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to add item. Try again.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <WorkspaceDialog title="Add action item" onClose={onClose} busy={saving}>
      <form className="max-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving}>
          <label>
            Item title *
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={2000}
              autoFocus
              placeholder="Enter an action item"
            />
          </label>
          <label>
            Section
            <select
              aria-label="Section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {sections.map((s) => (
                <option key={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <div className="max-owner-fields">
            <span>Owners</span>
            {owners.map((owner, index) => (
              <div className="max-owner-row" key={index}>
                <input
                  aria-label={`Owner ${index + 1}`}
                  value={owner.name}
                  maxLength={200}
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
                  aria-label={`Remove owner ${index + 1}`}
                  onClick={() =>
                    setOwners((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setOwners((current) => [
                  ...current,
                  { name: '', isExternal: false },
                ])
              }
            >
              + Add owner
            </button>
          </div>
          <div className="max-form-columns">
            <label>
              Target type
              <select
                aria-label="Target type"
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
              Target
              {target.type === 'date' ? (
                <input
                  aria-label="Target"
                  type="date"
                  value={target.value}
                  onChange={(e) =>
                    setTarget({ ...target, value: e.target.value })
                  }
                />
              ) : (
                <textarea
                  aria-label="Target"
                  rows={2}
                  value={target.value}
                  onChange={(e) =>
                    setTarget({ ...target, value: e.target.value })
                  }
                  placeholder="e.g. Before job walk"
                />
              )}
            </label>
            <label>
              Optional hard date
              <input
                type="date"
                value={hardDate}
                onChange={(e) => setHardDate(e.target.value)}
              />
            </label>
            <label>
              Status
              <select
                aria-label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                aria-label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {priorities.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="max-check">
            <input
              type="checkbox"
              checked={attention}
              onChange={(e) => setAttention(e.target.checked)}
            />
            Attention this week
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="max-error">
            {error}
          </p>
        )}
        <div className="max-dialog-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="max-primary"
            type="submit"
            disabled={!title.trim() || saving}
          >
            {saving ? 'Adding…' : 'Add item'}
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  )
}
