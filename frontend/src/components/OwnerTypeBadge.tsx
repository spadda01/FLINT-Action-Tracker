import './OwnerTypeBadge.css'
import { useId } from 'react'
import {
  getOwnerType,
  OWNER_TYPE_LABELS,
  type Owner,
} from '../services/ownerTypes'

type Props = {
  owner: Owner
}

const ICONS = {
  staff: '♟',
  external: '↗',
  organization: '▣',
} as const

export default function OwnerTypeBadge({ owner }: Props) {
  const type = getOwnerType(owner)
  const label = OWNER_TYPE_LABELS[type]
  const tooltipId = useId()

  return (
    <span className={`owner-type-badge owner-type-${type}`}>
      <span
        className="owner-type-indicator"
        tabIndex={0}
        aria-label={`${owner.name}: ${label}`}
        aria-describedby={tooltipId}
      >
        <span aria-hidden="true">{ICONS[type]}</span>
        {' '}
        {owner.name}
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="owner-type-tooltip"
      >
        {label}
      </span>
    </span>
  )
}
