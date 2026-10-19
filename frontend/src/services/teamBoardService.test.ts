import { describe, expect, it, vi } from 'vitest'
import { getBoard, saveTeamBoard } from './teamBoardService'
import type { SavedBoard, TeamBoardInput } from '../types/board'

const input: TeamBoardInput = {
  name: 'A&E Department Tasks',
  members: [
    { id: 'E002', type: 'user' },
    { id: 'G001', type: 'group' },
  ],
  egnyteFolderUrl: 'https://flint.egnyte.com/navigate/folder/ae-team',
}

const savedBoard: SavedBoard = {
  id: 'B001',
  name: 'A&E Department Tasks',
  type: 'Team',
  projectId: null,
  members: [
    { id: 'E002', type: 'user', name: 'Sarah Lee' },
    { id: 'G001', type: 'group', name: 'A&E Department' },
  ],
  egnyteFolderUrl: 'https://flint.egnyte.com/navigate/folder/ae-team',
  createdAt: '2026-10-17T00:00:00+00:00',
}

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('saveTeamBoard', () => {
  it('posts the board name, members and folder link', async () => {
    const fetchMock = mockFetch(201, savedBoard)

    await saveTeamBoard(input)

    expect(fetchMock).toHaveBeenCalledWith('/api/boards/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  })

  it('does not send a project link', async () => {
    const fetchMock = mockFetch(201, savedBoard)

    await saveTeamBoard(input)

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).not.toHaveProperty('projectId')
  })

  it('returns the saved team board on success', async () => {
    mockFetch(201, savedBoard)

    const result = await saveTeamBoard(input)

    expect(result).toEqual({ ok: true, board: savedBoard })
  })

  it('returns field errors when the server rejects the input', async () => {
    mockFetch(422, {
      errors: {
        name: 'Board name is required.',
        members: 'Add at least one member or group.',
      },
    })

    const result = await saveTeamBoard(input)

    expect(result).toEqual({
      ok: false,
      message: 'The board was not saved. Fix the highlighted fields and try again.',
      fieldErrors: {
        name: 'Board name is required.',
        members: 'Add at least one member or group.',
      },
    })
  })

  it('falls back to a general message for a 422 without field errors', async () => {
    mockFetch(422, { detail: 'something else' })

    const result = await saveTeamBoard(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('error 422')
      expect(result.fieldErrors).toEqual({})
    }
  })

  it('reports a server error and says entries are kept', async () => {
    mockFetch(500)

    const result = await saveTeamBoard(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('error 500')
      expect(result.message).toContain('Your entries are kept')
    }
  })

  it('reports when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await saveTeamBoard(input)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain("server can't be reached")
    }
  })
})

describe('getBoard', () => {
  it('returns the saved board when reopened', async () => {
    const fetchMock = mockFetch(200, savedBoard)

    const board = await getBoard('B001')

    expect(fetchMock).toHaveBeenCalledWith('/api/boards/B001')
    expect(board).toEqual(savedBoard)
  })

  it('returns null for a board that does not exist', async () => {
    mockFetch(404, { detail: 'Board not found' })

    expect(await getBoard('B999')).toBeNull()
  })

  it('throws on other server errors', async () => {
    mockFetch(500)

    await expect(getBoard('B001')).rejects.toThrow('error 500')
  })
})
