import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import ActionItemsTable from './ActionItemsTable'

function json(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

beforeEach(() => {
    // simulate an empty Action Items response from the backend
    vi.stubGlobal('fetch', vi.fn(async () => json([])))
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

test('shows an empty message when no action items exist', async () => {
    render(<ActionItemsTable boardId="project-1" />)

    expect(
        await screen.findByText('No action items found.')
    ).toBeTruthy()

    expect(
        screen.queryByText('Loading action items...')
    ).toBeNull()
})

test('displays action items returned by the API', async () => {
    const items = [
        {
            id: 1,
            priority: 'High',
            title: 'Review construction drawings',
            owners: [{ name: 'Austin', isExternal: false }],
            target: 'Before next meeting',
            hardDate: '2026-10-30',
            status: 'In Progress',
            attention: true,
        },
    ]

    // replace the default empty response with one action item
    vi.mocked(fetch).mockResolvedValue(json(items))

    render(<ActionItemsTable boardId="project-1" />)

    expect(
        await screen.findByText('Review construction drawings')
    ).toBeTruthy()

    expect(screen.getByText('Austin')).toBeTruthy()
    expect(screen.getByText('High')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()

    expect(fetch).toHaveBeenCalledWith('/api/boards/project-1/items')
})

test('displays an error when the API request fails', async () => {
    // Simulate a backend failure with HTTP 503.
    vi.mocked(fetch).mockResolvedValue(json({}, 503))

    render(<ActionItemsTable boardId="project-1" />)

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain(
        'Unable to load action items. Please try again.'
    )

    expect(
        screen.queryByText('No action items found.')
    ).toBeNull()
})

test('shows a loading message while waiting for the API', () => {
    // Keep the API request pending to test the loading state.
    vi.mocked(fetch).mockImplementation(
        () => new Promise<Response>(() => { })
    )

    render(<ActionItemsTable boardId="project-1" />)

    expect(
        screen.getByText('Loading action items...')
    ).toBeTruthy()

    expect(
        screen.queryByText('No action items found.')
    ).toBeNull()
})

test('fetches new action items when the selected board changes', async () => {
    const { rerender } = render(
        <ActionItemsTable boardId="project-1" />
    )

    await screen.findByText('No action items found.')

    rerender(<ActionItemsTable boardId="team-1" />)

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/boards/team-1/items')
    })
})

test('displays all seven Action Items column headers', () => {
    render(<ActionItemsTable boardId="project-1" />)

    const headers = [
        'Priority',
        'Deliverable / Action',
        'Owners',
        'Target',
        'Hard Date',
        'Status',
        'Attention',
    ]

    for (const header of headers) {
        expect(
            screen.getByRole('columnheader', { name: header })
        ).toBeTruthy()
    }
})