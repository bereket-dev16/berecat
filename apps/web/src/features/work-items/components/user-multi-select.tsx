import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import { useId } from 'react'
import type { UserOption } from '../work-item-types'

interface UserMultiSelectProps {
  users: UserOption[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  disabled?: boolean
  label?: string
}

function selectionSummary(users: UserOption[], selectedIds: string[]): string {
  const selectedUsers = users.filter((user) => selectedIds.includes(user.id))

  if (selectedUsers.length === 0) {
    return 'Atama yapılmadı'
  }

  if (selectedUsers.length === 1) {
    return selectedUsers[0].displayName
  }

  return `${selectedUsers.length} kişi seçildi`
}

export function UserMultiSelect({
  users,
  selectedIds,
  onChange,
  disabled = false,
  label = 'Atanan Kişiler',
}: UserMultiSelectProps) {
  const summary = selectionSummary(users, selectedIds)
  const summaryId = useId()
  const displayNameCounts = new Map<string, number>()

  users.forEach((user) => {
    displayNameCounts.set(
      user.displayName,
      (displayNameCounts.get(user.displayName) ?? 0) + 1,
    )
  })

  function toggleUser(userId: string, checked: boolean) {
    if (checked) {
      onChange(
        selectedIds.includes(userId)
          ? selectedIds
          : [...selectedIds, userId],
      )
      return
    }

    onChange(selectedIds.filter((id) => id !== userId))
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          aria-describedby={summaryId}
          className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-white/12 bg-black/20 px-3 text-left text-sm text-zinc-100 outline-none hover:border-[var(--brand-green)]/65 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span id={summaryId} className="min-w-0 truncate">
            {summary}
          </span>
          <ChevronDown aria-hidden="true" className="shrink-0 text-zinc-400" size={17} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[70] max-h-[min(20rem,var(--radix-popover-content-available-height))] w-[min(22rem,var(--radix-popover-trigger-width))] min-w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-lg border border-[var(--brand-green)]/55 bg-[var(--surface-raised)] p-2 shadow-[0_18px_48px_rgba(0,0,0,0.48)] outline-none"
        >
          <p className="px-2 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            {label}
          </p>

          {users.length === 0 ? (
            <p className="rounded-md px-2 py-3 text-sm text-zinc-400">
              Atanabilecek aktif kullanıcı yok.
            </p>
          ) : (
            <div className="space-y-1">
              {users.map((user) => {
                const checked = selectedIds.includes(user.id)

                return (
                  <label
                    key={user.id}
                    className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm text-zinc-100 outline-none hover:bg-white/6 focus-within:ring-2 focus-within:ring-[var(--brand-gold)]"
                  >
                    <span className="relative grid size-4 shrink-0 place-items-center rounded border border-white/25 bg-black/20">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          toggleUser(user.id, event.target.checked)
                        }
                        className="peer absolute inset-0 cursor-pointer opacity-0"
                        aria-label={
                          displayNameCounts.get(user.displayName) === 1
                            ? user.displayName
                            : `${user.displayName} (@${user.username})`
                        }
                      />
                      {checked ? (
                        <Check
                          aria-hidden="true"
                          className="text-[var(--brand-gold)]"
                          size={13}
                          strokeWidth={3}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {user.displayName}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500">
                      @{user.username}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
