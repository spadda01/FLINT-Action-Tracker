import { useState } from 'react'
import { saveTeamBoard } from './teamBoardService'
import type {
  SavedBoard,
  TeamBoardFieldErrors,
  TeamBoardInput,
} from '../types/board'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

// Holds only the save result. The form keeps its own input state,
// so entered values stay in place after a failed save.
export function useSaveTeamBoard() {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<TeamBoardFieldErrors>({})
  const [savedBoard, setSavedBoard] = useState<SavedBoard | null>(null)

  async function save(input: TeamBoardInput) {
    setStatus('saving')
    setMessage('')
    setFieldErrors({})

    const result = await saveTeamBoard(input)

    if (result.ok) {
      setStatus('saved')
      setMessage(`Team board "${result.board.name}" was created.`)
      setSavedBoard(result.board)
    } else {
      setStatus('failed')
      setMessage(result.message)
      setFieldErrors(result.fieldErrors)
    }

    return result
  }

  return { save, status, message, fieldErrors, savedBoard }
}
