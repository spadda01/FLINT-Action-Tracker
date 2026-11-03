export type Project = {
  id: string
  name: string
  egnyteFolder: string
  teamMembers: { id: string; name: string }[]
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects')
  if (!response.ok) throw new Error('Unable to load projects.')
  return response.json() as Promise<Project[]>
}
