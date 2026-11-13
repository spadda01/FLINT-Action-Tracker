import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardWorkspace from './BoardWorkspace'
import type { ActionItem } from '../services/actionItemService'

const seed: ActionItem[] = [
  {
    id: 1,
    title: 'Confirm equipment',
    section: 'Procurement',
    owners: [{ name: 'Jim', isExternal: true }],
    target: 'Before job walk',
    hardDate: null,
    status: 'Open',
    priority: 'High',
    attention: true,
  },
  {
    id: 2,
    title: 'Share notes',
    section: 'Coordination',
    owners: [],
    target: { type: 'date', value: '2026-11-08' },
    hardDate: null,
    status: 'Not Started',
    priority: 'Low',
    attention: false,
  },
]
let items: ActionItem[]
let sections: { id: string; name: string }[]
let failPatch: boolean
let failStatus: boolean
let failMove: boolean
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  items = structuredClone(seed)
  sections = [
    { id: 's1', name: 'Procurement' },
    { id: 's2', name: 'Coordination' },
  ]
  failPatch = false
  failStatus = false
  failMove = false
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
  fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const data = init?.body ? JSON.parse(String(init.body)) : null
    if (path === '/api/priorities')
      return Response.json([
        { name: 'Urgent', rank: 0 },
        { name: 'High', rank: 1 },
        { name: 'Medium', rank: 2 },
        { name: 'Low', rank: 3 },
      ])
    if (path.endsWith('/statuses'))
      return Response.json([
        'Open',
        'Not Started',
        'In Progress',
        'Scheduled',
        'Outstanding',
        'Complete',
      ])
    if (path.endsWith('/sections') && init?.method === 'POST') {
      const section = { id: 's' + (sections.length + 1), name: data.name }
      sections.push(section)
      return Response.json(section, { status: 201 })
    }
    if (path.endsWith('/sections')) return Response.json(sections)
    if (path.endsWith('/sections/order')) {
      sections = data.sectionIds.map((id: string) =>
        sections.find((s) => s.id === id)!,
      )
      return Response.json(sections)
    }
    if (path.endsWith('/items') && init?.method === 'POST') {
      const item: ActionItem = {
        ...seed[0],
        id: items.length + 1,
        title: data.title,
        section: data.section ?? 'General',
        owners: [],
        target: '',
        hardDate: null,
        status: 'Open',
        priority: 'Medium',
        attention: false,
        ...data,
      }
      items.push(item)
      return Response.json(item, { status: 201 })
    }
    if (path.endsWith('/items')) return Response.json(items)
    const id = Number(path.match(/\/items\/(\d+)/)?.[1])
    const item = items.find((i) => i.id === id)
    if (!item) return Response.json({}, { status: 404 })
    if (path.endsWith('/status')) {
      if (failStatus) return Response.json({}, { status: 500 })
      item.status = data.status
      return Response.json({
        item: {
          id: item.id,
          boardId: 'project-1',
          title: item.title,
          status: item.status,
        },
        change: null,
      })
    }
    if (path.endsWith('/move')) {
      if (failMove) return Response.json({}, { status: 500 })
      item.section = sections.find((s) => s.id === data.sectionId)!.name
      items = items.filter((i) => i.id !== id)
      const index =
        data.beforeItemId === null
          ? items.length
          : items.findIndex((i) => i.id === data.beforeItemId)
      items.splice(index, 0, item)
      return Response.json(items)
    }
    if (init?.method === 'PATCH') {
      if (failPatch) return Response.json({}, { status: 500 })
      Object.assign(item, data)
      return Response.json(item)
    }
    return Response.json({}, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
})

async function openWorkspace() {
  render(<BoardWorkspace boardId="project-1" />)
  await screen.findByRole('button', {
    name: 'Edit title for Confirm equipment',
  })
}

function itemRow(title = 'Confirm equipment') {
  return screen
    .getByRole('button', { name: `Edit title for ${title}` })
    .closest('tr')!
}

test('uses section tables, searches owners, and applies and clears filters', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  expect(screen.getAllByRole('table')).toHaveLength(2)
  expect(
    within(screen.getAllByRole('table')[0])
      .getAllByRole('columnheader')
      .map((h) => h.textContent),
  ).toEqual([
    'Move',
    'Item',
    'Owners',
    'Target',
    'Status',
    'Priority',
    'Attention',
  ])
  await user.type(
    screen.getByRole('searchbox', { name: 'Search action items' }),
    'jim',
  )
  expect(
    screen.queryByRole('button', { name: 'Edit title for Share notes' }),
  ).not.toBeInTheDocument()
  await user.clear(
    screen.getByRole('searchbox', { name: 'Search action items' }),
  )
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  await user.click(screen.getByLabelText('Attention items only'))
  await user.click(screen.getByRole('button', { name: 'Apply' }))
  expect(
    screen.queryByRole('button', { name: 'Edit title for Share notes' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Filters •' }))
  await user.click(screen.getByRole('button', { name: 'Clear' }))
  expect(
    screen.getByRole('button', { name: 'Edit title for Share notes' }),
  ).toBeInTheDocument()
})

test('opens add dialog with keyboard, rejects spaces and sends every chosen field', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  screen.getByRole('button', { name: '+ Add item' }).focus()
  await user.keyboard('{Enter}')
  const dialog = screen.getByRole('dialog', { name: 'Add action item' })
  await user.type(within(dialog).getByLabelText('Item title *'), '   ')
  expect(
    within(dialog).getByRole('button', { name: 'Add item' }),
  ).toBeDisabled()
  await user.clear(within(dialog).getByLabelText('Item title *'))
  await user.type(
    within(dialog).getByLabelText('Item title *'),
    'New meeting action',
  )
  await user.selectOptions(
    within(dialog).getByLabelText('Section', { exact: true }),
    'Coordination',
  )
  await user.click(within(dialog).getByRole('button', { name: '+ Add owner' }))
  await user.type(
    within(dialog).getByLabelText('Owner 1', { exact: true }),
    'Taylor',
  )
  await user.click(within(dialog).getByLabelText('External', { exact: true }))
  await user.selectOptions(
    within(dialog).getByLabelText('Target type', { exact: true }),
    'date',
  )
  await user.type(
    within(dialog).getByLabelText('Target', { exact: true }),
    '2026-11-09',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Add item' }))
  await screen.findByRole('button', {
    name: 'Edit title for New meeting action',
  })
  const saved = items.find((i) => i.title === 'New meeting action')!
  expect(saved).toMatchObject({
    section: 'Coordination',
    owners: [{ name: 'Taylor', isExternal: true }],
    status: 'Open',
    priority: 'Medium',
    target: { type: 'date', value: '2026-11-09' },
  })
})

test('failed target and priority saves retain draft and retry; configured levels appear', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  await user.click(
    screen.getByRole('button', { name: 'Edit target for Confirm equipment' }),
  )
  const input = screen.getByLabelText('Target for Confirm equipment', {
    exact: true,
  })
  await user.clear(input)
  await user.type(input, '  Exact{Enter}target  ')
  failPatch = true
  await user.click(within(itemRow()).getByRole('button', { name: 'Save' }))
  await screen.findByRole('alert')
  expect(input).toHaveValue('  Exact\ntarget  ')
  failPatch = false
  await user.click(screen.getByRole('button', { name: 'Retry save' }))
  await screen.findByRole('button', {
    name: 'Edit target for Confirm equipment',
  })
  expect(items[0].target).toEqual({ type: 'text', value: '  Exact\ntarget  ' })
  await user.click(
    screen.getByRole('button', { name: 'Edit priority for Confirm equipment' }),
  )
  await user.selectOptions(
    screen.getByLabelText('Priority for Confirm equipment', { exact: true }),
    'Urgent',
  )
  failPatch = true
  await user.click(within(itemRow()).getByRole('button', { name: 'Save' }))
  await screen.findByRole('alert')
  expect(
    screen.getByLabelText('Priority for Confirm equipment', { exact: true }),
  ).toHaveValue('Urgent')
  failPatch = false
  await user.click(screen.getByRole('button', { name: 'Retry save' }))
  await waitFor(() => expect(items[0].priority).toBe('Urgent'))
})

test('status failure offers retry without a false success announcement', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  failStatus = true
  await user.click(
    screen.getByRole('button', {
      name: 'Change status for Confirm equipment, currently Open',
    }),
  )
  await user.click(screen.getByRole('menuitemradio', { name: 'Complete' }))
  await screen.findByRole('button', { name: 'Try again' })
  expect(
    screen.queryByText('Status changed to Complete.'),
  ).not.toBeInTheDocument()
  failStatus = false
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByText('Status changed to Complete.'),
  ).toBeInTheDocument()
})

test('quick entry keeps focus and creates in the chosen section with Open default', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  const input = screen.getByRole('textbox', {
    name: 'New action item in Coordination',
  })
  await user.type(input, 'First{Enter}')
  await screen.findByRole('button', { name: 'Edit title for First' })
  await waitFor(() => expect(input).toHaveFocus())
  await user.type(input, 'Second{Enter}')
  await screen.findByRole('button', { name: 'Edit title for Second' })
  expect(
    items
      .filter((i) => i.title === 'First' || i.title === 'Second')
      .map((i) => [i.section, i.status]),
  ).toEqual([
    ['Coordination', 'Open'],
    ['Coordination', 'Open'],
  ])
})

test('keyboard move dialog saves destination and preserves empty source section', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  screen.getByRole('button', { name: 'Move Confirm equipment' }).focus()
  await user.keyboard('{Enter}')
  await user.selectOptions(screen.getByLabelText('Destination section'), 's2')
  await user.click(screen.getByRole('button', { name: 'Move item' }))
  await waitFor(() =>
    expect(items.find((i) => i.id === 1)?.section).toBe('Coordination'),
  )
  expect(
    within(
      screen.getByRole('region', { name: 'Procurement section' }),
    ).getByText('No items — drag an item here or add one below.'),
  ).toBeInTheDocument()
  expect(
    within(
      screen.getByRole('region', { name: 'Coordination section' }),
    ).getByRole('button', { name: 'Edit title for Confirm equipment' }),
  ).toBeInTheDocument()
})

test('failed move leaves item in place and dialog can retry', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  failMove = true
  await user.click(
    screen.getByRole('button', { name: 'Move Confirm equipment' }),
  )
  await user.selectOptions(screen.getByLabelText('Destination section'), 's2')
  await user.click(screen.getByRole('button', { name: 'Move item' }))
  await screen.findByRole('alert')
  expect(items.find((i) => i.id === 1)?.section).toBe('Procurement')
  failMove = false
  await user.click(screen.getByRole('button', { name: 'Move item' }))
  await waitFor(() =>
    expect(items.find((i) => i.id === 1)?.section).toBe('Coordination'),
  )
})

test('attention failure rolls back, preserves a retry action, and saves on retry', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  failPatch = true
  await user.click(
    screen.getByRole('checkbox', { name: 'Attention for Confirm equipment' }),
  )
  await screen.findByRole('alert')
  expect(
    screen.getByRole('checkbox', { name: 'Attention for Confirm equipment' }),
  ).toBeChecked()
  failPatch = false
  await user.click(screen.getByRole('button', { name: 'Retry attention' }))
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', { name: 'Attention for Confirm equipment' }),
    ).not.toBeChecked(),
  )
})

test('Tab reaches Filters and Add item; cancelled dialog does not create an item', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  screen.getByRole('searchbox', { name: 'Search action items' }).focus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: '+ Add item' })).toHaveFocus()
  await user.keyboard('{Enter}')
  const dialog = screen.getByRole('dialog', { name: 'Add action item' })
  await user.type(
    within(dialog).getByLabelText('Item title *'),
    'Cancelled item',
  )
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(items).toHaveLength(2)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '+ Add item' })).toHaveFocus()
})

test.each(['project-1', 'team-1'])(
  'shows matching items out of each section total on %s',
  async (boardId) => {
    items.push(
      {
        ...seed[0],
        id: 3,
        title: 'Inspect equipment',
        priority: 'Low',
        attention: false,
      },
      { ...seed[0], id: 4, title: 'Request quote', attention: false },
    )
    sections.push({ id: 's3', name: 'Empty section' })
    const user = userEvent.setup()
    render(<BoardWorkspace boardId={boardId} />)
    const procurement = await screen.findByRole('region', {
      name: 'Procurement section',
    })
    const coordination = screen.getByRole('region', {
      name: 'Coordination section',
    })
    expect(within(procurement).getByText('3 of 3 items')).toBeInTheDocument()
    expect(within(coordination).getByText('1 of 1 item')).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Empty section section' }),
      ).getByText('0 of 0 items'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByLabelText('Attention items only'))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(within(procurement).getByText('1 of 3 items')).toBeInTheDocument()
    expect(within(coordination).getByText('0 of 1 item')).toBeInTheDocument()

    const search = screen.getByRole('searchbox', {
      name: 'Search action items',
    })
    await user.type(search, 'missing')
    expect(within(procurement).getByText('0 of 3 items')).toBeInTheDocument()
    await user.clear(search)
    await user.click(screen.getByRole('button', { name: 'Filters •' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.type(search, 'equipment')
    expect(within(procurement).getByText('2 of 3 items')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(
      screen.getByLabelText('Priority', { exact: true }),
      'Low',
    )
    await user.selectOptions(screen.getByLabelText('Sort items'), 'target')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(within(procurement).getByText('1 of 3 items')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Clear view to move items' }),
    )
    expect(within(procurement).getByText('3 of 3 items')).toBeInTheDocument()

    await user.type(
      within(procurement).getByRole('textbox', {
        name: 'New action item in Procurement',
      }),
      'New action{Enter}',
    )
    await waitFor(() =>
      expect(within(procurement).getByText('4 of 4 items')).toBeInTheDocument(),
    )
  },
)

test('AT-147 filters board items by all three stored owner types', async () => {
  const user = userEvent.setup()

  items.push(
    {
      ...structuredClone(seed[1]),
      id: 3,
      title: 'Staff task',
      owners: [{ name: 'Alice', isExternal: false }],
    },
    {
      ...structuredClone(seed[1]),
      id: 4,
      title: 'Organization task',
      owners: [
        {
          name: 'Carol',
          isExternal: true,
          organizationId: 'org-123',
        },
      ],
    },
  )

  await openWorkspace()

  async function applyOwnerFilter(type: string) {
    await user.click(
      screen.getByRole('button', { name: /Filters/ }),
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Owner type' }),
      type,
    )
    await user.click(screen.getByRole('button', { name: 'Apply' }))
  }

  await applyOwnerFilter('staff')
  expect(screen.getByRole('button', {
    name: 'Edit title for Staff task',
  })).toBeInTheDocument()
  expect(screen.queryByRole('button', {
    name: 'Edit title for Confirm equipment',
  })).not.toBeInTheDocument()

  await applyOwnerFilter('external')
  expect(screen.getByRole('button', {
    name: 'Edit title for Confirm equipment',
  })).toBeInTheDocument()
  expect(screen.queryByRole('button', {
    name: 'Edit title for Organization task',
  })).not.toBeInTheDocument()

  await applyOwnerFilter('organization')
  expect(screen.getByRole('button', {
    name: 'Edit title for Organization task',
  })).toBeInTheDocument()
  expect(screen.queryByRole('button', {
    name: 'Edit title for Staff task',
  })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Filters/ }))
  await user.click(screen.getByRole('button', { name: 'Clear' }))

  expect(screen.getByRole('button', {
    name: 'Edit title for Staff task',
  })).toBeInTheDocument()
  expect(screen.getByRole('button', {
    name: 'Edit title for Organization task',
  })).toBeInTheDocument()
})

test('AT-147 combines owner type with priority and attention filters', async () => {
  const user = userEvent.setup()

  items.push({
    ...structuredClone(seed[1]),
    id: 3,
    title: 'Other external task',
    owners: [{ name: 'David', isExternal: true }],
    priority: 'Low',
    attention: false,
  })

  await openWorkspace()

  await user.click(screen.getByRole('button', { name: 'Filters' }))

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Owner type' }),
    'external',
  )

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Priority' }),
    'High',
  )

  await user.click(screen.getByLabelText('Attention items only'))
  await user.click(screen.getByRole('button', { name: 'Apply' }))

  expect(screen.getByRole('button', {
    name: 'Edit title for Confirm equipment',
  })).toBeInTheDocument()

  expect(screen.queryByRole('button', {
    name: 'Edit title for Other external task',
  })).not.toBeInTheDocument()

  expect(screen.queryByRole('button', {
    name: 'Edit title for Share notes',
  })).not.toBeInTheDocument()
})
