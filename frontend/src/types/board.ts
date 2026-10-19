export type BoardMemberType = 'user' | 'group'

export type BoardMemberSelection = {
  id: string
  type: BoardMemberType
}

export type BoardMember = BoardMemberSelection & {
  name: string
}

export type TeamBoardInput = {
  name: string
  members: BoardMemberSelection[]
  egnyteFolderUrl: string
}

// Same shape for project and team boards; team boards always have projectId null.
export type SavedBoard = {
  id: string
  name: string
  type: 'Project' | 'Team'
  projectId: string | null
  members: BoardMember[]
  egnyteFolderUrl: string
  createdAt: string
}

export type TeamBoardFieldErrors = Partial<
  Record<keyof TeamBoardInput | 'projectId', string>
>
