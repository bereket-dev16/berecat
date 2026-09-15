import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserOption } from '../work-item-types'
import { UserMultiSelect } from './user-multi-select'

const users: UserOption[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    username: 'deniz',
    displayName: 'Deniz',
    role: 'member',
    team: 'graphic',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    username: 'selin',
    displayName: 'Selin',
    role: 'member',
    team: 'digital',
  },
]

afterEach(() => {
  cleanup()
})

function renderMultiSelect(selectedIds: string[] = [], disabled = false) {
  const onChange = vi.fn()

  function ControlledMultiSelect() {
    const [currentIds, setCurrentIds] = useState(selectedIds)

    return (
      <UserMultiSelect
        users={users}
        selectedIds={currentIds}
        disabled={disabled}
        onChange={(nextIds) => {
          onChange(nextIds)
          setCurrentIds(nextIds)
        }}
      />
    )
  }

  render(<ControlledMultiSelect />)

  return { onChange }
}

describe('UserMultiSelect', () => {
  it('işlev adını korurken seçim özetini erişilebilir açıklama olarak sunar', () => {
    renderMultiSelect()

    const trigger = screen.getByRole('button', {
      name: 'Atanan Kişiler',
      description: 'Atama yapılmadı',
    })

    expect(trigger).toHaveTextContent('Atama yapılmadı')
  })

  it('tek seçimde kullanıcı adını, birden fazla seçimde kişi sayısını gösterir', () => {
    const { rerender } = render(
      <UserMultiSelect
        users={users}
        selectedIds={[users[0].id]}
        onChange={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: 'Atanan Kişiler',
      description: 'Deniz',
    })

    expect(trigger).toHaveTextContent('Deniz')

    rerender(
      <UserMultiSelect
        users={users}
        selectedIds={users.map((user) => user.id)}
        onChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: 'Atanan Kişiler',
        description: '2 kişi seçildi',
      }),
    ).toBe(trigger)
    expect(trigger).toHaveTextContent('2 kişi seçildi')
  })

  it('aynı görünen ada sahip kullanıcıları checkbox adında kullanıcı adıyla ayırır', async () => {
    const usersWithDuplicateDisplayNames: UserOption[] = [
      users[0],
      { ...users[1], displayName: users[0].displayName },
    ]

    render(
      <UserMultiSelect
        users={usersWithDuplicateDisplayNames}
        selectedIds={[]}
        onChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Atanan Kişiler' }))

    expect(
      await screen.findByRole('checkbox', { name: 'Deniz (@deniz)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Deniz (@selin)' }),
    ).toBeInTheDocument()
  })

  it('mevcut seçimleri işaretli gösterir', async () => {
    renderMultiSelect([users[1].id])

    fireEvent.click(screen.getByRole('button', { name: 'Atanan Kişiler' }))

    const selinCheckbox = await screen.findByRole('checkbox', { name: 'Selin' })
    const denizCheckbox = screen.getByRole('checkbox', { name: 'Deniz' })

    expect((selinCheckbox as HTMLInputElement).checked).toBe(true)
    expect((denizCheckbox as HTMLInputElement).checked).toBe(false)
  })

  it('checkbox seçimlerini ekler ve son seçimi kaldırınca boş diziyi kabul eder', async () => {
    const { onChange } = renderMultiSelect()

    fireEvent.click(screen.getByRole('button', { name: 'Atanan Kişiler' }))
    const denizCheckbox = await screen.findByRole('checkbox', { name: 'Deniz' })

    fireEvent.click(denizCheckbox)
    expect(onChange).toHaveBeenLastCalledWith([users[0].id])
    expect((denizCheckbox as HTMLInputElement).checked).toBe(true)

    fireEvent.click(denizCheckbox)
    expect(onChange).toHaveBeenLastCalledWith([])
    expect((denizCheckbox as HTMLInputElement).checked).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Atanan Kişiler' }),
    ).toHaveTextContent('Atama yapılmadı')
  })

  it('Escape ile açık seçim listesini kapatır', async () => {
    renderMultiSelect()

    fireEvent.click(screen.getByRole('button', { name: 'Atanan Kişiler' }))
    expect(
      await screen.findByRole('checkbox', { name: 'Deniz' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    await waitFor(() => {
      expect(
        screen.queryByRole('checkbox', { name: 'Deniz' }),
      ).not.toBeInTheDocument()
    })
  })

  it('disabled durumda seçim listesini açmaz', () => {
    renderMultiSelect([], true)
    const trigger = screen.getByRole('button', { name: 'Atanan Kişiler' })

    expect(trigger).toBeDisabled()
    fireEvent.click(trigger)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
