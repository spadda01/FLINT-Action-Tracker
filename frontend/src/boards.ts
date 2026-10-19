export type Board = {
    id: string
    name: string
    type: 'Project' | 'Team'
    openItemCount: number
}

export type MockBoardRecord = Board & {
    isArchived: boolean
    memberIds: string[]
}

export const mockCurrentUserId = 'user-1'

export const sampleBoards: MockBoardRecord[] = [
    {
        id: 'project-1',
        name: 'Sample Project',
        type: 'Project',
        openItemCount: 5,
        isArchived: false,
        memberIds: ['user-1'],
    },
    {
        id: 'project-2',
        name: 'Sample Office Renovation',
        type: 'Project',
        openItemCount: 12,
        isArchived: false,
        memberIds: ['user-1', 'user-2'],
    },
    {
        id: 'team-1',
        name: 'Sample A&E Team',
        type: 'Team',
        openItemCount: 8,
        isArchived: false,
        memberIds: ['user-1'],
    },
    {
        id: 'team-2',
        name: 'Sample Operations Team',
        type: 'Team',
        openItemCount: 3,
        isArchived: false,
        memberIds: ['user-1', 'user-2'],
    },
    {
        id: 'project-archived',
        name: 'Sample Archived Project',
        type: 'Project',
        openItemCount: 0,
        isArchived: true,
        memberIds: ['user-1'],
    },
    {
        id: 'team-restricted',
        name: 'Sample Restricted Team',
        type: 'Team',
        openItemCount: 4,
        isArchived: false,
        memberIds: ['user-2'],
    },
]