export type Item = {
  id: number
  priority: string
  title: string
  owners: string[]
  target: string
  status: string
  attention: boolean
};

export const mockItems: Item[] = [
  {
    id: 1,
    priority: "high",
    title: "Item 1",
    owners: ["John Doe", "Jane Smith"],
    target: "ASAP",
    status: "open",
    attention: true
  }, 
  {
    id: 2,
    priority: "medium",
    title: "Item 2",
    owners: ["John Doe"],
    target: "Before job walk",
    status: "open",
    attention: false
  },
  {
    id: 3,
    priority: "low",
    title: "Item 3",
    owners: ["Jane Smith"],
    target: "2026-11-01",
    status: "open",
    attention: false
  },
  {
    id: 4,
    priority: "high",
    title: "Item 4",
    owners: ["John Doe", "Jane Smith"],
    target: "ASAP",
    status: "open",
    attention: true
  }
]

