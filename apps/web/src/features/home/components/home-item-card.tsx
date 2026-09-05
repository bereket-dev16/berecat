import type { HomeItem } from '../home-types'
import { formatHomeDate } from '../format-home-date'

interface HomeItemCardProps {
  item: HomeItem
  onSelect: (item: HomeItem, trigger: HTMLButtonElement) => void
}

function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toLocaleUpperCase('tr-TR')
}

export function HomeItemCard({ item, onSelect }: HomeItemCardProps) {
  return (
    <button
      type="button"
      onClick={(event) => onSelect(item, event.currentTarget)}
      aria-label={`${item.title} işini görüntüle`}
      className="group w-full cursor-pointer rounded-lg border border-white/6 bg-[var(--card-olive)] px-3.5 py-3 text-left shadow-sm outline-none hover:border-[var(--brand-gold)]/60 hover:bg-[var(--card-olive-hover)] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--module-surface)]"
    >
      <span className="block min-h-10 text-[0.82rem] font-semibold leading-5 text-zinc-50">
        {item.title}
      </span>

      <span className="mt-3 flex items-end justify-between gap-3">
        <time
          dateTime={item.dueDate}
          className="text-xs font-medium text-zinc-100"
        >
          {formatHomeDate(item.dueDate)}
        </time>

        <span className="flex -space-x-1.5" aria-label="Atanan kişiler">
          {item.assignees.map((assignee) => (
            <span
              key={assignee.id}
              title={assignee.displayName}
              aria-label={assignee.displayName}
              className="grid size-7 place-items-center rounded-full border-2 border-[var(--card-olive)] bg-[var(--brand-orange)] text-[0.7rem] font-bold text-zinc-950 group-hover:border-[var(--card-olive-hover)]"
            >
              {getInitial(assignee.displayName)}
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}
