export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type ItemHistoryEntry = {
  id: string
  boardId: string
  itemId: number
  actorId: string
  changedAt: string
  field: string
  oldValue: JsonValue
  newValue: JsonValue
}