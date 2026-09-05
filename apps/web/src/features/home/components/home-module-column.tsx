import type { HomeItem, HomeModule } from '../home-types'
import { HomeItemCard } from './home-item-card'

interface HomeModuleColumnProps {
  module: HomeModule
  onSelectItem: (item: HomeItem, trigger: HTMLButtonElement) => void
}

export function HomeModuleColumn({
  module,
  onSelectItem,
}: HomeModuleColumnProps) {
  return (
    <section
      aria-labelledby={`module-${module.id}`}
      className="w-[min(78vw,16.5rem)] shrink-0 self-start overflow-hidden rounded-lg border border-white/7 bg-[var(--module-surface)] shadow-[0_8px_24px_rgba(0,0,0,0.16)] sm:w-[16.5rem]"
    >
      <h2
        id={`module-${module.id}`}
        className="border-b border-[var(--brand-orange)]/45 px-3.5 py-3 text-[0.78rem] font-semibold leading-5 text-zinc-100"
      >
        {module.title}
      </h2>

      <div className="space-y-2.5 p-2.5">
        {module.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/10 bg-white/[0.025] px-3 py-4 text-center text-xs text-zinc-200">
            Henüz iş yok.
          </p>
        ) : (
          module.items.map((item) => (
            <HomeItemCard key={item.id} item={item} onSelect={onSelectItem} />
          ))
        )}
      </div>
    </section>
  )
}
