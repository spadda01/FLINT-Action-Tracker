import type { SaveStatus } from '../services/useSaveTeamBoard'

type Props = {
  status: SaveStatus
  message: string
}

// Success is announced politely; failure uses role="alert" so screen
// readers read it right away.
export default function SaveStatusMessage({ status, message }: Props) {
  if (status === 'saving') {
    return <p role="status">Saving board…</p>
  }

  if (!message) return null

  if (status === 'saved') {
    return (
      <p role="status" style={{ color: '#3d6b10', fontWeight: 600 }}>
        {message}
      </p>
    )
  }

  return (
    <p role="alert" style={{ color: '#b42318', fontWeight: 600 }}>
      {message}
    </p>
  )
}
