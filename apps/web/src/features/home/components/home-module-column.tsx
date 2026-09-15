import { useDroppable } from '@dnd-kit/react'
import { Plus } from 'lucide-react'
import type { HomeItem, HomeModule } from '../home-types'
import { HomeItemCard } from './home-item-card'

interface HomeModuleColumnProps {
  module: HomeModule
  onCreateItem: (module: HomeModule, trigger: HTMLButtonElement) => void
  onSelectItem: (item: HomeItem, trigger: HTMLElement) => void
  onCompleteItem: (item: HomeItem) => void
  onDuplicateItem: (item: HomeItem) => void
  onEditItem: (item: HomeItem, trigger: HTMLButtonElement) => void
  onDeleteItem: (item: HomeItem, trigger: HTMLButtonElement) => void
  completingItemId: string | null
  duplicatingItemId: string | null
  editingItemId: string | null
  deletingItemId: string | null
}

export function HomeModuleColumn({
  module,
  onCreateItem,
  onSelectItem,
  onCompleteItem,
  onDuplicateItem,
  onEditItem,
  onDeleteItem,
  completingItemId,
  duplicatingItemId,
  editingItemId,
  deletingItemId,
}: HomeModuleColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id: `module:${module.id}`,
    type: 'work-item-module',
    accept: 'work-item',
    data: { moduleKey: module.id },
  })
  const activeItems = module.items.filter((item) => item.status === 'active')

  return (
    <section
      ref={ref}
      aria-labelledby={`module-${module.id}`}
      data-testid={`work-item-module-${module.id}`}
      data-droppable="true"
      className={`w-[min(78vw,16.5rem)] shrink-0 self-start overflow-hidden rounded-lg border bg-[var(--module-surface)] shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition-[border-color,background-color] sm:w-[16.5rem] ${isDropTarget ? 'border-[var(--brand-gold)] bg-[#3f4638]' : 'border-white/7'}`}
    >
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[var(--brand-orange)]/45 px-3.5 py-2">
        <h2
          id={`module-${module.id}`}
          className="text-[0.78rem] font-semibold leading-5 text-zinc-100"
        >
          {module.title}
        </h2>
        <button
          type="button"
          onClick={(event) => onCreateItem(module, event.currentTarget)}
          aria-label={`${module.title} modülüne iş ekle`}
          className="grid size-8 shrink-0 place-items-center rounded-md bg-[#12b76a] text-zinc-950 outline-none hover:bg-[#39cc83] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--module-surface)]"
        >
          <Plus aria-hidden="true" size={18} strokeWidth={2.4} />
        </button>
      </div>

      <div className="space-y-2.5 p-2.5">
        {activeItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/10 bg-white/[0.025] px-3 py-4 text-center text-xs text-zinc-200">
            Henüz iş yok.
          </p>
        ) : (
          activeItems.map((item) => (
            <HomeItemCard
              key={item.id}
              item={item}
              moduleKey={module.id}
              isCompleting={completingItemId === item.id}
              isDuplicating={duplicatingItemId === item.id}
              isEditing={editingItemId === item.id}
              isDeleting={deletingItemId === item.id}
              onSelect={onSelectItem}
              onComplete={onCompleteItem}
              onDuplicate={onDuplicateItem}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
            />
          ))
        )}
      </div>
    </section>
  )
}
