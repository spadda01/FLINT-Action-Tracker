import type {
  SavedBoard,
  TeamBoardFieldErrors,
  TeamBoardInput,
} from '../types/board'

// saveTeamBoard never throws: every outcome comes back as a result the form can show.
export type SaveTeamBoardResult =
  | { ok: true; board: SavedBoard }
  | { ok: false; message: string; fieldErrors: TeamBoardFieldErrors }

export async function saveTeamBoard(
  input: TeamBoardInput,
): Promise<SaveTeamBoardResult> {
  let response: Response
  try {
    response = await fetch('/api/boards/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    return {
      ok: false,
      message:
        "The board couldn't be saved because the server can't be reached. Your entries are kept, so you can try again.",
      fieldErrors: {},
    }
  }

  if (response.ok) {
    return { ok: true, board: (await response.json()) as SavedBoard }
  }

  // 422 means the server rejected the input; its errors are keyed by form field.
  if (response.status === 422) {
    const body = await response.json().catch(() => null)
    if (body?.errors) {
      return {
        ok: false,
        message: 'The board was not saved. Fix the highlighted fields and try again.',
        fieldErrors: body.errors as TeamBoardFieldErrors,
      }
    }
  }

  return {
    ok: false,
    message: `The board couldn't be saved (error ${response.status}). Your entries are kept, so you can try again.`,
    fieldErrors: {},
  }
}

export async function getBoard(boardId: string): Promise<SavedBoard | null> {
  const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Failed to load board (error ${response.status})`)
  return (await response.json()) as SavedBoard
}
