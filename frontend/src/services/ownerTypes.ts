export type Owner = {
  name: string
  isExternal: boolean
  organizationId?: string | null
}

export type OwnerType = 'staff' | 'external' | 'organization'

export function getOwnerType(owner: Owner): OwnerType {
  if (!owner.isExternal) {
    return 'staff'
  }

  if (owner.organizationId?.trim()) {
    return 'organization'
  }

  return 'external'
}

export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
  staff: 'Staff member',
  external: 'Free-text external contact',
  organization: 'Organization-backed owner',
}
