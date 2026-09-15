import { useDraggable } from '@dnd-kit/react'
import { CheckCircle2, Copy, Pencil, Trash2 } from 'lucide-react'
import { useId } from 'react'
import type { WorkItemModuleKey } from '../../work-items/work-item-constants'
import type { HomeItem } from '../home-types'
import { formatHomeDate } from '../format-home-date'

export interface HomeItemDragData {
  item: HomeItem
  moduleKey: WorkItemModuleKey
}

interface HomeItemCardProps {
  item: HomeItem
  moduleKey: WorkItemModuleKey
  isCompleting: boolean
  isDuplicating: boolean
  isEditing: boolean
  isDeleting: boolean
  onSelect: (item: HomeItem, trigger: HTMLElement) => void
  onComplete: (item: HomeItem) => void
  onDuplicate: (item: HomeItem) => void
  onEdit: (item: HomeItem, trigger: HTMLButtonElement) => void
  onDelete: (item: HomeItem, trigger: HTMLButtonElement) => void
}

function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toLocaleUpperCase('tr-TR')
}

export function HomeItemCard({
  item,
  moduleKey,
  isCompleting,
  isDuplicating,
  isEditing,
  isDeleting,
  onSelect,
  onComplete,
  onDuplicate,
  onEdit,
  onDelete,
}: HomeItemCardProps) {
  const instructionsId = useId()
  const { ref, isDragging } = useDraggable<HomeItemDragData>({
    id: item.id,
    type: 'work-item',
    data: { item, moduleKey },
    disabled: item.status !== 'active',
  })
  const actionPending =
    isCompleting || isDuplicating || isEditing || isDeleting

  return (
    <article
      ref={ref}
      role="group"
      tabIndex={0}
      aria-label={`${item.title} sürüklenebilir iş kartı`}
      aria-roledescription="sürüklenebilir iş kartı"
      aria-describedby={instructionsId}
      data-testid={`work-item-card-${item.id}`}
      data-draggable={item.status === 'active' ? 'true' : 'false'}
      onClick={(event) => {
        if (!isDragging) {
          onSelect(item, event.currentTarget)
        }
      }}
      className={`group cursor-grab rounded-lg border border-white/6 bg-[var(--card-olive)] text-left shadow-sm outline-none transition-[border-color,background-color,opacity] hover:border-[var(--brand-gold)]/60 hover:bg-[var(--card-olive-hover)] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--module-surface)] active:cursor-grabbing ${isDragging ? 'opacity-35' : ''}`}
    >
      <span id={instructionsId} className="sr-only">
        Taşımayı başlatmak için Boşluk veya Enter tuşuna basın. Sol ve Sağ Ok ile birim seçin; Boşluk veya Enter ile bırakın, Escape ile iptal edin.
      </span>

      <div className="px-3.5 py-3">
        <button
          type="button"
          data-no-drag
          onClick={(event) => {
            event.stopPropagation()
            onSelect(item, event.currentTarget)
          }}
          aria-label={`${item.title} işini görüntüle`}
          className="block w-full rounded-sm text-left text-[0.82rem] font-semibold leading-5 text-zinc-50 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
        >
          {item.title}
        </button>

        {item.dueDate || item.assignees.length > 0 ? (
          <div className="mt-3 flex min-h-7 items-end justify-between gap-3">
            {item.dueDate ? (
              <time dateTime={item.dueDate} className="text-xs font-medium text-zinc-100">
                {formatHomeDate(item.dueDate)}
              </time>
            ) : (
              <span />
            )}

            {item.assignees.length > 0 ? (
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
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        data-no-drag
        className="flex items-center justify-end gap-1.5 border-t border-white/8 px-2.5 py-2"
      >
        <button
          type="button"
          data-no-drag
          aria-label="İşi çoğalt"
          title="İşi çoğalt"
          disabled={actionPending}
          aria-busy={isDuplicating}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onDuplicate(item)
          }}
          className="grid size-8 place-items-center rounded-md text-zinc-200 outline-none hover:bg-black/20 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-45"
        >
          <Copy aria-hidden="true" size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          data-no-drag
          aria-label="İşi düzenle"
          title="İşi düzenle"
          disabled={actionPending}
          aria-busy={isEditing}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onEdit(item, event.currentTarget)
          }}
          className="grid size-8 place-items-center rounded-md text-zinc-200 outline-none hover:bg-black/20 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-45"
        >
          <Pencil aria-hidden="true" size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          data-no-drag
          aria-label="İşi sil"
          title="İşi sil"
          disabled={actionPending}
          aria-busy={isDeleting}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onDelete(item, event.currentTarget)
          }}
          className="grid size-8 place-items-center rounded-md text-[#ffad7d] outline-none hover:bg-black/20 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-45"
        >
          <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          data-no-drag
          aria-label="İşi tamamla"
          title="İşi tamamla"
          disabled={actionPending}
          aria-busy={isCompleting}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onComplete(item)
          }}
          className="grid size-8 place-items-center rounded-md text-[var(--brand-gold)] outline-none hover:bg-black/20 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-45"
        >
          <CheckCircle2 aria-hidden="true" size={17} strokeWidth={2.1} />
        </button>
      </div>
    </article>
  )
}
