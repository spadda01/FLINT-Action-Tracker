export type Board = {
  id: string
  name: string
  type: 'Project' | 'Team'
  openItemCount: number
}

export const sampleBoards: Board[] = [
  {
    id: 'project-1',
    name: 'Sample Project',
    type: 'Project',
    openItemCount: 5,
  },
  {
    id: 'project-2',
    name: 'Sample Office Renovation',
    type: 'Project',
    openItemCount: 12,
  },
  {
    id: 'team-1',
    name: 'Sample A&E Team',
    type: 'Team',
    openItemCount: 8,
  },
  {
    id: 'team-2',
    name: 'Sample Operations Team',
    type: 'Team',
    openItemCount: 3,
  },
]