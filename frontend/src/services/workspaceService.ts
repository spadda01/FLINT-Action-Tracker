import type { ActionItem } from './actionItemService'
import type { TargetDisplay } from '../target'

export type Section = { id: string; name: string }
export type ItemInput = {
  title: string
  section: string
  owners: ActionItem['owners']
  target: TargetDisplay
  hardDate: string | null
  status: string
  priority: string
  attention: boolean
}

async function request<T>(
  path: string,
  method?: string,
  body?: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(
      path,
      method
        ? {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : undefined,
    )
  } catch {
    throw new Error(
      'The server cannot be reached. Your entries are kept. Try again.',
    )
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const detail = typeof error?.detail === 'string' ? error.detail : null
    throw new Error(
      detail ??
        `The change could not be saved (error ${response.status}). Your entries are kept. Try again.`,
    )
  }
  return response.json() as Promise<T>
}

const base = (id: string) => `/api/boards/${encodeURIComponent(id)}`
export const loadSections = (id: string) =>
  request<Section[]>(`${base(id)}/sections`)
export const createSection = (id: string, name: string) =>
  request<Section>(`${base(id)}/sections`, 'POST', { name })
export const renameSection = (id: string, sectionId: string, name: string) =>
  request<Section>(
    `${base(id)}/sections/${encodeURIComponent(sectionId)}`,
    'PATCH',
    { name },
  )
export const orderSections = (id: string, sectionIds: string[]) =>
  request<Section[]>(`${base(id)}/sections/order`, 'PUT', { sectionIds })
export const moveItem = (
  id: string,
  itemId: number,
  sectionId: string,
  beforeItemId: number | null,
) =>
  request<ActionItem[]>(`${base(id)}/items/${itemId}/move`, 'POST', {
    sectionId,
    beforeItemId,
  })
export const createItem = (
  id: string,
  input: ItemInput | { title: string; section: string },
) => request<ActionItem>(`${base(id)}/items`, 'POST', input)
export const updateItem = (
  id: string,
  itemId: number,
  update: Partial<Omit<ItemInput, 'section'>>,
) => request<ActionItem>(`${base(id)}/items/${itemId}`, 'PATCH', update)
