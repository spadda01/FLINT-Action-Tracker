import { describe, expect, it } from 'vitest'
import { getOwnerType } from './ownerTypes'

describe('AT-64 owner type classification', () => {
  it('identifies staff owners', () => {
    expect(getOwnerType({
      name: 'Alice',
      isExternal: false,
    })).toBe('staff')
  })

  it('identifies free-text external owners', () => {
    expect(getOwnerType({
      name: 'Bob',
      isExternal: true,
    })).toBe('external')
  })

  it('identifies organization-backed owners', () => {
    expect(getOwnerType({
      name: 'Carol',
      isExternal: true,
      organizationId: 'org-123',
    })).toBe('organization')
  })

  it('treats an empty organization ID as free-text external', () => {
    expect(getOwnerType({
      name: 'David',
      isExternal: true,
      organizationId: '   ',
    })).toBe('external')
  })

  it('does not classify staff as organization-backed', () => {
    expect(getOwnerType({
      name: 'Eve',
      isExternal: false,
      organizationId: 'org-123',
    })).toBe('staff')
  })
})
