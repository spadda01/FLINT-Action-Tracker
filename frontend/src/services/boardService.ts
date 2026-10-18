import type { Board } from '../boards'

export async function loadBoards(): Promise<Board[]> { // this function will eventually return an array of baords
    // requests boards already in the server
    const response = await fetch('/api/boards')

    if (!response.ok) {
        throw new Error('Unable to load boards')
    }
    return (await response.json()) as Board[]
}