import { describe, expect, it, vi } from 'vitest'
import {
    changeItemStatus,
    loadBoardStatuses,
    loadStatusHistory,
    StatusRequestError,
} from './itemStatusService'
import type { StatusChangeResult, StatusHistoryEntry } from '../types/itemStatus'

const entry: StatusHistoryEntry = {
    itemId: 2,
    boardId: 'project-1',
    actorId: 'user-1',
    changedAt: '2026-10-28T10:00:01+00:00',
    oldStatus: 'Not Started',
    newStatus: 'Scheduled',
}

const result: StatusChangeResult = {
    item: { id: 2, boardId: 'project-1', title: 'Confirm material delivery', status: 'Scheduled' },
    change: entry,
}

function mockFetch(status: number, body?: unknown) {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(body === undefined ? null : JSON.stringify(body), { status }),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

async function failureOf(promise: Promise<unknown>): Promise<StatusRequestError> {
    try {
        await promise
    } catch (error) {
        if (error instanceof StatusRequestError) return error
        throw error
    }
    throw new Error('Expected the request to fail')
}

describe('changeItemStatus', () => {
    it('sends the new status to the item status endpoint', async () => {
        const fetchMock = mockFetch(200, result)

        await changeItemStatus('project-1', 2, 'Scheduled')

        expect(fetchMock).toHaveBeenCalledWith('/api/boards/project-1/items/2/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Scheduled' }),
        })
    })

    it('returns the saved item and its history entry', async () => {
        mockFetch(200, result)

        expect(await changeItemStatus('project-1', 2, 'Scheduled')).toEqual(result)
    })

    it('encodes board ids that contain special characters', async () => {
        const fetchMock = mockFetch(200, result)

        await changeItemStatus('A&E board', 2, 'Open')

        expect(fetchMock.mock.calls[0][0]).toBe('/api/boards/A%26E%20board/items/2/status')
    })

    it("uses the server's message when the status is rejected", async () => {
        mockFetch(422, { errors: { status: 'Done is not a status on this board.' } })

        const error = await failureOf(changeItemStatus('project-1', 2, 'Done'))

        expect(error.status).toBe(422)
        expect(error.message).toBe('Done is not a status on this board.')
    })

    it.each([
        [401, 'Your sign-in could not be confirmed'],
        [403, "You don't have permission"],
        [404, "This item isn't available"],
        [500, 'error 500'],
    ])('explains a %i response', async (status, text) => {
        mockFetch(status, { detail: 'x' })

        const error = await failureOf(changeItemStatus('project-1', 2, 'Open'))

        expect(error.status).toBe(status)
        expect(error.message).toContain(text)
    })

    it('explains when the server cannot be reached', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

        const error = await failureOf(changeItemStatus('project-1', 2, 'Open'))

        expect(error.status).toBe(0)
        expect(error.message).toContain("can't be reached")
    })
})

describe('loadBoardStatuses', () => {
    it("returns the board's status list", async () => {
        const fetchMock = mockFetch(200, ['Open', 'Complete'])

        expect(await loadBoardStatuses('team-1')).toEqual(['Open', 'Complete'])
        expect(fetchMock).toHaveBeenCalledWith('/api/boards/team-1/statuses', undefined)
    })

    it('fails with a message when the board is unavailable', async () => {
        mockFetch(404)

        const error = await failureOf(loadBoardStatuses('team-restricted'))

        expect(error.status).toBe(404)
    })
})

describe('loadStatusHistory', () => {
    it("returns the item's history", async () => {
        const fetchMock = mockFetch(200, [entry])

        expect(await loadStatusHistory('project-1', 2)).toEqual([entry])
        expect(fetchMock).toHaveBeenCalledWith('/api/boards/project-1/items/2/history', undefined)
    })

    it('returns an empty list for an item that has never changed', async () => {
        mockFetch(200, [])

        expect(await loadStatusHistory('project-1', 1)).toEqual([])
    })
})
