import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

let signedIn: boolean
let signInStatus: number
let signOutStatus: number
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  signedIn = false
  signInStatus = 204
  signOutStatus = 204
  fetchMock = vi.fn(async (path: string) => {
    if (path === '/api/auth/sign-in') {
      if (signInStatus === 204) signedIn = true
      return new Response(null, { status: signInStatus })
    }
    if (path === '/api/auth/sign-out') {
      if (signOutStatus === 204) signedIn = false
      return new Response(null, { status: signOutStatus })
    }
    if (!signedIn) return new Response(null, { status: 401 })
    if (path === '/api/auth/session') return new Response(null, { status: 204 })
    if (path === '/api/me') return Response.json({ id: 'user-1' })
    if (path === '/api/boards') {
      return Response.json([{ id: 'project-1', name: 'Synthetic Project', type: 'Project', openItemCount: 0 }])
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.useRealTimers())

test('gates deep links and only loads boards after successful mock sign-in', async () => {
  window.history.replaceState(null, '', '/#/create-project-board')
  signInStatus = 403
  const user = userEvent.setup()
  render(<App />)

  const signIn = await screen.findByRole('button', { name: 'Mock sign in' })
  expect(screen.queryByRole('heading', { name: 'Create Project Board' })).toBeNull()
  expect(fetchMock.mock.calls).toEqual([['/api/me']])
  await user.tab()
  expect(signIn).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('account or tenant is unauthorized')
  expect(fetchMock).not.toHaveBeenCalledWith('/api/boards')

  window.history.replaceState(null, '', '/')
  signInStatus = 204
  await user.click(signIn)
  expect(await screen.findByRole('button', { name: 'Synthetic Project' })).toBeVisible()
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-in', {
    method: 'POST', headers: { 'X-Mock-Auth': '1' },
  })
})

test('clears board content after confirmed sign-out and can retry a failed sign-out', async () => {
  signedIn = true
  signOutStatus = 503
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('button', { name: 'Synthetic Project' })

  const signOut = screen.getByRole('button', { name: 'Sign out' })
  await user.click(signOut)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign out')

  signOutStatus = 204
  await user.click(signOut)
  expect(await screen.findByRole('button', { name: 'Mock sign in' })).toBeVisible()
  expect(screen.queryByText('Synthetic Project')).toBeNull()
})

test('a passive session check returns an expired user to the sign-in screen', async () => {
  signedIn = true
  vi.useFakeTimers()
  await act(async () => { render(<App />) })
  expect(screen.getByRole('button', { name: 'Synthetic Project' })).toBeVisible()

  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/session', undefined)
  expect(fetchMock.mock.calls.filter(([path]) => path === '/api/me')).toHaveLength(1)

  signedIn = false
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(screen.getByRole('status')).toHaveTextContent('Your session ended')
  expect(screen.getByRole('button', { name: 'Mock sign in' })).toBeVisible()
  expect(screen.queryByText('Synthetic Project')).toBeNull()
})
