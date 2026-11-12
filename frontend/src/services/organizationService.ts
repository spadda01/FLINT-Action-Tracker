export type Organization = { id: string; name: string }

export type OrganizationsState = {
  status: 'loading' | 'ready' | 'error'
  organizations: Organization[]
}

// FLINT's known-company list. The backend serves mock data until the real
// list is provided; the contract (id + name) stays the same.
export async function loadOrganizations(): Promise<Organization[]> {
  let response: Response
  try {
    response = await fetch('/api/companies')
  } catch {
    throw new Error('The organization list cannot be reached.')
  }
  if (!response.ok) {
    throw new Error(
      `Unable to load the organization list (error ${response.status}).`,
    )
  }
  return (await response.json()) as Organization[]
}

export function organizationName(
  organizations: Organization[],
  id: string | null | undefined,
): string | null {
  if (!id) return null
  return organizations.find((o) => o.id === id)?.name ?? id
}
