export class AuthRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super('Mock authentication request failed')
    this.status = status
  }
}

export async function mockAuth(action: 'sign-in' | 'sign-out' | 'session'): Promise<void> {
  const options = action === 'session'
    ? undefined
    : { method: 'POST', headers: { 'X-Mock-Auth': '1' } }
  const response = await fetch(`/api/auth/${action}`, options)
  if (!response.ok) throw new AuthRequestError(response.status)
}
