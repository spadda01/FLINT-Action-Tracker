import type { OrganizationsState } from '../services/organizationService'

// Native <select>: fully keyboard operable (arrows, type-ahead, Enter/Escape).
export default function OrganizationSelect({
  label,
  value,
  state,
  onChange,
  onRetry,
}: {
  label: string
  value: string | null | undefined
  state: OrganizationsState
  onChange: (organizationId: string | null) => void
  onRetry: () => void
}) {
  const known = state.organizations.some((o) => o.id === value)
  const failed = state.status === 'error'
  return (
    <span className="max-organization">
      <select
        aria-label={label}
        value={value ?? ''}
        disabled={state.status === 'loading' || failed}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">
          {state.status === 'loading'
            ? 'Loading organizations…'
            : state.status === 'ready' && !state.organizations.length
              ? 'No organizations available'
              : 'No organization'}
        </option>
        {value && !known && (
          <option value={value}>{value} (not in list)</option>
        )}
        {state.organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      {failed && (
        <span role="alert" className="max-error">
          Unable to load organizations.{' '}
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </span>
      )}
    </span>
  )
}
