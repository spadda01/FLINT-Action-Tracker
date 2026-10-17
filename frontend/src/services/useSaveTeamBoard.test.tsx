import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SaveStatusMessage from '../components/SaveStatusMessage'
import { useSaveTeamBoard } from './useSaveTeamBoard'

// Minimal stand-in for the team board form, so the save flow can be tested
// before the real form is merged into frontend/.
function TestForm() {
  const [name, setName] = useState('')
  const [egnyteFolderUrl, setEgnyteFolderUrl] = useState('')
  const { save, status, message, fieldErrors } = useSaveTeamBoard()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save({ name, members: [{ id: 'E002', type: 'user' }], egnyteFolderUrl })
      }}
    >
      <label htmlFor="name">Board name</label>
      <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      {fieldErrors.name && <span>{fieldErrors.name}</span>}

      <label htmlFor="link">Egnyte folder link</label>
      <input id="link" value={egnyteFolderUrl} onChange={(e) => setEgnyteFolderUrl(e.target.value)} />
      {fieldErrors.egnyteFolderUrl && <span>{fieldErrors.egnyteFolderUrl}</span>}

      <button type="submit">Create board</button>
      <SaveStatusMessage status={status} message={message} />
    </form>
  )
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  )
}

async function fillAndSubmit(name: string, link: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Board name'), name)
  await user.type(screen.getByLabelText('Egnyte folder link'), link)
  await user.click(screen.getByRole('button', { name: 'Create board' }))
}

describe('useSaveTeamBoard', () => {
  it('shows a success message after the board is saved', async () => {
    respondWith(201, {
      id: 'B001',
      name: 'Ops Team',
      type: 'Team',
      projectId: null,
      members: [{ id: 'E002', type: 'user', name: 'Sarah Lee' }],
      egnyteFolderUrl: 'https://flint.egnyte.com/ops',
      createdAt: '2026-10-17T00:00:00+00:00',
    })
    render(<TestForm />)

    await fillAndSubmit('Ops Team', 'https://flint.egnyte.com/ops')

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Team board "Ops Team" was created.',
    )
  })

  it('shows field errors from the server beside the right fields', async () => {
    respondWith(422, {
      errors: { egnyteFolderUrl: 'Egnyte folder link must be a full http or https link.' },
    })
    render(<TestForm />)

    await fillAndSubmit('Ops Team', 'not-a-link')

    expect(await screen.findByRole('alert')).toHaveTextContent('The board was not saved')
    expect(
      screen.getByText('Egnyte folder link must be a full http or https link.'),
    ).toBeInTheDocument()
  })

  it('keeps entered values after a failed save so the user can retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    render(<TestForm />)

    await fillAndSubmit('Ops Team', 'https://flint.egnyte.com/ops')

    expect(await screen.findByRole('alert')).toHaveTextContent("server can't be reached")
    expect(screen.getByLabelText('Board name')).toHaveValue('Ops Team')
    expect(screen.getByLabelText('Egnyte folder link')).toHaveValue('https://flint.egnyte.com/ops')
  })

  it('clears the old error when the user retries successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'B001',
              name: 'Ops Team',
              type: 'Team',
              projectId: null,
              members: [],
              egnyteFolderUrl: 'https://flint.egnyte.com/ops',
              createdAt: '2026-10-17T00:00:00+00:00',
            }),
            { status: 201 },
          ),
        ),
    )
    render(<TestForm />)
    await fillAndSubmit('Ops Team', 'https://flint.egnyte.com/ops')
    await screen.findByRole('alert')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Create board' }))

    expect(await screen.findByRole('status')).toHaveTextContent('was created')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
