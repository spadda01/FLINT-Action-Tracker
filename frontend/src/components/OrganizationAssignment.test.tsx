import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardWorkspace from './BoardWorkspace'
import type { ActionItem } from '../services/actionItemService'

// Fictional mock companies only; no FLINT data.
const companies = [
  { id: 'CO001', name: 'Example Structural Engineering' },
  { id: 'CO002', name: 'Sample Mechanical Contractors' },
]

let items: ActionItem[]
let companiesResponse: () => Response
let patchResponse: (data: unknown) => Response
let requests: {
  path: string
  method?: string
  body: { owners?: Record<string, unknown>[] } & Record<string, unknown>
}[]

beforeEach(() => {
  items = [
    {
      id: 1,
      title: 'Confirm equipment',
      section: 'Procurement',
      owners: [
        { name: 'Jim', isExternal: true, organizationId: 'CO001' },
        { name: 'Austin', isExternal: false },
      ],
      target: 'Before job walk',
      hardDate: null,
      status: 'Open',
      priority: 'High',
      attention: false,
    },
  ]
  companiesResponse = () => Response.json(companies)
  patchResponse = (data) => Response.json({ ...items[0], ...(data as object) })
  requests = []
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null
      requests.push({ path, method: init?.method, body })
      if (path === '/api/companies') return companiesResponse()
      if (path === '/api/priorities')
        return Response.json([
          { name: 'High', rank: 1 },
          { name: 'Medium', rank: 2 },
        ])
      if (path.endsWith('/statuses')) return Response.json(['Open'])
      if (path.endsWith('/sections'))
        return Response.json([{ id: 's1', name: 'Procurement' }])
      if (path.endsWith('/items') && init?.method === 'POST') {
        const created = { ...items[0], id: 2, ...body }
        items.push(created)
        return Response.json(created, { status: 201 })
      }
      if (path.endsWith('/items')) return Response.json(items)
      if (init?.method === 'PATCH') {
        const response = patchResponse(body)
        if (response.ok) Object.assign(items[0], body)
        return response
      }
      return Response.json({}, { status: 404 })
    }),
  )
})

async function openWorkspace() {
  render(<BoardWorkspace boardId="project-1" />)
  await screen.findByRole('button', { name: 'Edit title for Confirm equipment' })
}

test('shows the assigned organization name beside an external owner only', async () => {
  await openWorkspace()
  const row = screen
    .getByRole('button', { name: 'Edit title for Confirm equipment' })
    .closest('tr')!
  expect(
    await within(row).findByText(/Example Structural Engineering/),
  ).toBeInTheDocument()
  expect(within(row).getByText(/Austin/).textContent).not.toMatch(/Engineering/)
})

test('add dialog lists the known companies for external owners and saves the choice', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  await user.click(screen.getByRole('button', { name: '+ Add item' }))
  const dialog = screen.getByRole('dialog', { name: 'Add action item' })
  await user.type(within(dialog).getByLabelText(/Item title/), 'Order pipe')
  await user.click(within(dialog).getByRole('button', { name: '+ Add owner' }))
  expect(
    within(dialog).queryByLabelText('Organization for owner 1'),
  ).not.toBeInTheDocument()
  await user.type(within(dialog).getByLabelText('Owner 1'), 'Pat')
  await user.click(within(dialog).getByLabelText('External'))
  const select = within(dialog).getByLabelText('Organization for owner 1')
  expect(
    within(select).getAllByRole('option').map((o) => o.textContent),
  ).toEqual(['No organization', ...companies.map((c) => c.name)])
  await user.selectOptions(select, 'CO002')
  await user.click(within(dialog).getByRole('button', { name: 'Add item' }))
  const post = requests.find((r) => r.method === 'POST')!
  expect(post.body.owners).toEqual([
    { name: 'Pat', isExternal: true, organizationId: 'CO002' },
  ])
})

test('unchecking External clears the organization', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  await user.click(screen.getByRole('button', { name: 'Edit owners for Confirm equipment' }))
  const external = screen.getAllByLabelText('External')[0]
  await user.click(external)
  expect(
    screen.queryByLabelText(/Organization for owner 1 of/),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('button', { name: 'Edit owners for Confirm equipment' })
  const patch = requests.find((r) => r.method === 'PATCH')!
  expect(patch.body.owners![0]).toEqual({
    name: 'Jim',
    isExternal: false,
    organizationId: null,
  })
})

test('inline editor changes an organization with the keyboard and saves it', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  const open = screen.getByRole('button', { name: 'Edit owners for Confirm equipment' })
  open.focus()
  await user.keyboard('{Enter}')
  const select = await screen.findByLabelText(
    'Organization for owner 1 of Confirm equipment',
  )
  expect(select).toHaveValue('CO001')
  await user.selectOptions(select, 'CO002')
  await user.keyboard('{Control>}{Enter}{/Control}')
  expect(
    await screen.findByText(/Sample Mechanical Contractors/),
  ).toBeInTheDocument()
  expect(requests.find((r) => r.method === 'PATCH')!.body.owners![0]).toMatchObject({
    organizationId: 'CO002',
  })
})

test('Escape closes the editor without saving', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  await user.click(screen.getByRole('button', { name: 'Edit owners for Confirm equipment' }))
  const select = screen.getByLabelText(/Organization for owner 1 of/)
  await user.selectOptions(select, 'CO002')
  await user.keyboard('{Escape}')
  expect(screen.queryByLabelText(/Organization for owner 1 of/)).not.toBeInTheDocument()
  expect(requests.some((r) => r.method === 'PATCH')).toBe(false)
})

test('a failed company list shows an alert, disables the dropdown and can be retried', async () => {
  const user = userEvent.setup()
  companiesResponse = () => Response.json({}, { status: 500 })
  await openWorkspace()
  await user.click(screen.getByRole('button', { name: 'Edit owners for Confirm equipment' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load organizations.',
  )
  expect(screen.getByLabelText(/Organization for owner 1 of/)).toBeDisabled()
  companiesResponse = () => Response.json(companies)
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await vi.waitFor(() =>
    expect(screen.getByLabelText(/Organization for owner 1 of/)).toBeEnabled(),
  )
  expect(screen.queryByText('Unable to load organizations.')).not.toBeInTheDocument()
})

test('a rejected save keeps the draft, shows the error and offers retry', async () => {
  const user = userEvent.setup()
  patchResponse = () =>
    Response.json(
      { detail: 'Choose an organization from the FLINT list.' },
      { status: 422 },
    )
  await openWorkspace()
  await user.click(screen.getByRole('button', { name: 'Edit owners for Confirm equipment' }))
  const select = await screen.findByLabelText(/Organization for owner 1 of/)
  await user.selectOptions(select, 'CO002')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Choose an organization from the FLINT list.',
  )
  expect(screen.getByLabelText(/Organization for owner 1 of/)).toHaveValue('CO002')
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument()
})

test('an organization that is no longer in the list is kept and labelled', async () => {
  items[0].owners[0].organizationId = 'CO999'
  const user = userEvent.setup()
  await openWorkspace()
  await user.click(screen.getByRole('button', { name: 'Edit owners for Confirm equipment' }))
  const select = await screen.findByLabelText(/Organization for owner 1 of/)
  expect(select).toHaveValue('CO999')
  expect(
    within(select).getByRole('option', { name: 'CO999 (not in list)' }),
  ).toBeInTheDocument()
})

test('searching finds items by organization name', async () => {
  const user = userEvent.setup()
  await openWorkspace()
  await screen.findByText(/Example Structural Engineering/)
  await user.type(
    screen.getByRole('searchbox', { name: 'Search action items' }),
    'structural',
  )
  expect(
    screen.getByRole('button', { name: 'Edit title for Confirm equipment' }),
  ).toBeInTheDocument()
  await user.clear(screen.getByRole('searchbox', { name: 'Search action items' }))
  await user.type(
    screen.getByRole('searchbox', { name: 'Search action items' }),
    'zzz',
  )
  expect(
    screen.queryByRole('button', { name: 'Edit title for Confirm equipment' }),
  ).not.toBeInTheDocument()
})
