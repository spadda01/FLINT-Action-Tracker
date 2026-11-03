import { useEffect, useState, type FormEvent } from 'react'
import { getProjects, type Project } from '../services/projectService'
import { loadMemberOptions, type MemberOption } from '../services/memberService'
import type { TeamBoardFieldErrors } from '../types/board'

type Props = { onCreated?: () => void }

export default function CreateProjectBoard({ onCreated }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [folder, setFolder] = useState('')
  const [selected, setSelected] = useState<string[]>([''])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [projectError, setProjectError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<TeamBoardFieldErrors>({})

  useEffect(() => {
    let active = true
    // Project lookup may fail independently; manual creation stays available.
    void getProjects()
      .then((data) => {
        if (active) setProjects(data)
      })
      .catch(() => {
        if (active)
          setProjectError(
            'Projects could not be loaded. You can create a board without a project.',
          )
      })
    void loadMemberOptions()
      .then((data) => {
        if (active) setMembers(data)
      })
      .catch(() => {
        if (active)
          setLoadError(
            'Unable to load employees and groups. Reload this page to try again.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function chooseProject(id: string) {
    setProjectId(id)
    const project = projects.find((entry) => entry.id === id)
    if (!project) return
    setName(project.name)
    // Mock folder paths aren't web links; ask the user for the full URL.
    setFolder(
      /^https?:\/\//.test(project.egnyteFolder) ? project.egnyteFolder : '',
    )
    setSelected(
      project.teamMembers.length
        ? project.teamMembers.map((member) => `user:${member.id}`)
        : [''],
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setErrors({})
    try {
      const response = await fetch('/api/boards/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          projectId: projectId || null,
          egnyteFolderUrl: folder.trim(),
          members: selected.filter(Boolean).map((value) => {
            const [type, id] = value.split(':')
            return { type, id }
          }),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setErrors(result.errors ?? {})
        setMessage(
          'Unable to create the board. Check your entries and try again.',
        )
        return
      }
      setMessage(`Project board "${result.name}" was created.`)
      onCreated?.()
    } catch {
      setMessage(
        'Unable to reach the server. Your entries are kept; try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2>Create Project Board</h2>
      <form onSubmit={(event) => void submit(event)}>
        <div>
          <label htmlFor="project-selection">FLINT Project</label>
          <select
            id="project-selection"
            value={projectId}
            onChange={(event) => chooseProject(event.target.value)}
          >
            <option value="">No project — link later</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {projectError && <p role="status">{projectError}</p>}
          {errors.projectId && <p role="alert">{errors.projectId}</p>}
        </div>
        <div>
          <label htmlFor="project-board-name">Board Name*</label>
          <input
            id="project-board-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={200}
          />
          {errors.name && <p role="alert">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="project-board-folder">Egnyte Folder Link*</label>
          <input
            id="project-board-folder"
            type="url"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            required
            placeholder="https://..."
          />
          {errors.egnyteFolderUrl && (
            <p role="alert">{errors.egnyteFolderUrl}</p>
          )}
        </div>
        <div>
          <label>Board Members*</label>
          {selected.map((value, index) => (
            <div key={index}>
              <select
                aria-label={`Project board member ${index + 1}`}
                value={value}
                required
                disabled={loading || !!loadError}
                onChange={(event) =>
                  setSelected((current) =>
                    current.map((entry, position) =>
                      position === index ? event.target.value : entry,
                    ),
                  )
                }
              >
                <option value="">Select an employee or group</option>
                {members
                  .filter(
                    (member) =>
                      `${member.type}:${member.id}` === value ||
                      !selected.includes(`${member.type}:${member.id}`),
                  )
                  .map((member) => (
                    <option
                      key={`${member.type}:${member.id}`}
                      value={`${member.type}:${member.id}`}
                    >
                      {member.name} (
                      {member.type === 'user' ? 'Employee' : 'Group'})
                    </option>
                  ))}
              </select>
              {selected.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected((current) =>
                      current.filter((_, position) => position !== index),
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
            disabled={
              loading || !!loadError || selected.length >= members.length
            }
            onClick={() => setSelected((current) => [...current, ''])}
          >
            Add Member
          </button>
          {errors.members && <p role="alert">{errors.members}</p>}
        </div>
        {loading && <p role="status">Loading members...</p>}
        {loadError && <p role="alert">{loadError}</p>}
        <button type="submit" disabled={saving || loading || !!loadError}>
          {saving ? 'Creating...' : 'Create Project Board'}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  )
}
