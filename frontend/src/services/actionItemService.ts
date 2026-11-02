import type { Target } from '../target'

export type ActionItem = {
  id: string
  title: string
  target: Target
}

export class ActionItemRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ActionItemRequestError'
    this.status = status
  }
}

export async function loadActionItems(boardId: string): Promise<ActionItem[]> {
  const response = await fetch(
    `/api/boards/${encodeURIComponent(boardId)}/items`,
  )

  if (!response.ok) {
    throw new ActionItemRequestError(
      `Unable to load action items (error ${response.status}).`,
      response.status,
    )
  }

  return (await response.json()) as ActionItem[]
}

export async function saveActionItemTarget(
  boardId: string,
  itemId: string,
  target: Target,
): Promise<ActionItem> {
  let response: Response
  try {
    response = await fetch(
      `/api/boards/${encodeURIComponent(boardId)}/items/${encodeURIComponent(itemId)}/target`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      },
    )
  } catch {
    throw new ActionItemRequestError(
      "The target couldn't be saved because the server can't be reached. Your change is kept so you can try again.",
    )
  }

  if (!response.ok) {
    throw new ActionItemRequestError(
      `The target couldn't be saved (error ${response.status}). Your change is kept so you can try again.`,
      response.status,
    )
  }

  return (await response.json()) as ActionItem
}
