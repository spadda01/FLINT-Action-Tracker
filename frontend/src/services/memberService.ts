
import type { BoardMemberSelection } from '../types/board'

export type MemberOption = BoardMemberSelection & {
  name: string
}

type ApiMember = {
  id: string
  name: string
}

// Load employees and groups, preserving their IDs and member types.
export async function loadMemberOptions(): Promise<MemberOption[]> {
  const [employeeResponse, groupResponse] = await Promise.all([
    fetch('/api/employees'),
    fetch('/api/groups'),
  ])

  if (!employeeResponse.ok || !groupResponse.ok) {
    throw new Error('Unable to load employees and groups.')
  }

  const employees = (await employeeResponse.json()) as ApiMember[]
  const groups = (await groupResponse.json()) as ApiMember[]

  return [
    ...employees.map((member) => ({
      id: member.id,
      name: member.name,
      type: 'user' as const,
    })),
    ...groups.map((member) => ({
      id: member.id,
      name: member.name,
      type: 'group' as const,
    })),
  ]
}
