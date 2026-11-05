import { useEffect, useState, type FormEvent } from 'react'
import { loadMemberOptions, type MemberOption } from '../services/memberService'
import { useSaveTeamBoard } from '../services/useSaveTeamBoard'
import type { BoardMemberSelection } from '../types/board'

function CreateTeamBoard({
  onCreated,
  onCancel,
  hideHeading = false,
}: {
  onCreated?: () => void
  onCancel?: () => void
  hideHeading?: boolean
}) {
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const { save, status, message, fieldErrors } = useSaveTeamBoard()
  const [boardName, setBoardName] = useState('')
  const [egnyteLink, setEgnyteLink] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([''])

  useEffect(() => {
    let active = true

    // Load available employees and groups for board membership.
    async function loadMembers() {
      try {
        const options = await loadMemberOptions()
        if (active) setMembers(options)
      } catch {
        if (active) setLoadError('Unable to load employees and groups.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadMembers()
    return () => {
      active = false
    }
  }, [])

  async function handleCreateBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'saving') return

    // Convert dropdown values into the IDs and types expected by FastAPI.
    const boardMembers: BoardMemberSelection[] = selectedMembers
      .filter(Boolean)
      .map((selection) => {
        const [type, id] = selection.split(':')

        return {
          id,
          type: type as BoardMemberSelection['type'],
        }
      })

    const result = await save({
      name: boardName.trim(),
      members: boardMembers,
      egnyteFolderUrl: egnyteLink.trim(),
    })
    if (result.ok) onCreated?.()
  }

  return (
    <section>
      {!hideHeading && <h2>Create Team Board</h2>}
      <form className="max-form max-team-form" onSubmit={handleCreateBoard}>
        <div>
          <label htmlFor="team-board-name">Board Name*</label>
          <input
            id="team-board-name"
            type="text"
            value={boardName}
            onChange={(event) => setBoardName(event.target.value)}
            placeholder="e.g. Department Tasks"
            required
          />
          {fieldErrors.name && <p role="alert">{fieldErrors.name}</p>}
        </div>

        <div>
          <label>Team Members*</label>

          {selectedMembers.map((selected, index) => (
            <div key={index}>
              <select
                aria-label={`Team member ${index + 1}`}
                value={selected}
                onChange={(event) => {
                  setSelectedMembers((current) =>
                    current.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  )
                }}
                disabled={loading || Boolean(loadError)}
                required
              >
                <option value="">Select an employee or group</option>

                {members
                  .filter(
                    (member) =>
                      `${member.type}:${member.id}` === selected ||
                      !selectedMembers.includes(`${member.type}:${member.id}`),
                  )
                  .map((member) => (
                    <option
                      key={`${member.type}-${member.id}`}
                      value={`${member.type}:${member.id}`}
                    >
                      {member.name} (
                      {member.type === 'user' ? 'Employee' : 'Group'})
                    </option>
                  ))}
              </select>

              {selectedMembers.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMembers((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setSelectedMembers((current) => [...current, ''])}
            disabled={
              loading ||
              Boolean(loadError) ||
              selectedMembers.length >= members.length
            }
          >
            Add Member
          </button>
        </div>
        <div>
          <label htmlFor="team-board-egnyte">Egnyte Folder Link*</label>
          <input
            id="team-board-egnyte"
            type="url"
            value={egnyteLink}
            onChange={(event) => setEgnyteLink(event.target.value)}
            placeholder="https://..."
            required
          />
          {fieldErrors.egnyteFolderUrl && (
            <p role="alert">{fieldErrors.egnyteFolderUrl}</p>
          )}
        </div>

        {fieldErrors.members && <p role="alert">{fieldErrors.members}</p>}
        {loading && <p role="status">Loading members...</p>}
        {loadError && <p role="alert">{loadError}</p>}
        {!loading && !loadError && (
          <p>{members.length} employees and groups available.</p>
        )}
        <div className="max-dialog-actions">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={status === 'saving'}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={status === 'saving' || loading || Boolean(loadError)}
          >
            {status === 'saving' ? 'Creating...' : 'Create Team Board'}
          </button>
        </div>

        {message && (
          <p role={status === 'failed' ? 'alert' : 'status'}>{message}</p>
        )}
      </form>
    </section>
  )
}

export default CreateTeamBoard
