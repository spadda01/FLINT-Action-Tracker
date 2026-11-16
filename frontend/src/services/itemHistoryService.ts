import type { ItemHistoryEntry } from '../types/itemHistory'

export async function loadItemHistory(
  boardId: string,
  itemId: number,
  signal?: AbortSignal,
): Promise<ItemHistoryEntry[]> {
  const path =
    `/api/boards/${encodeURIComponent(boardId)}` +
    `/items/${itemId}/history`

  let response: Response

  try {
    response = await fetch(path, { signal })
  } catch (cause) {
    // preserve cancellation when the user leaves the history view
    if (signal?.aborted) throw cause

    throw new Error(
      "History couldn't be loaded. Check your connection and try again.",
      { cause },
    )
  }

  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Your sign-in could not be confirmed. Refresh and try again.',
      403: "You don't have permission to view this history.",
      404: 'This item is unavailable or you do not have access.',
    }

    throw new Error(
      messages[response.status] ??
        "History couldn't be loaded. Please try again.",
    )
  }

  return (await response.json()) as ItemHistoryEntry[]
}