import { useRef, useState } from 'react'
import type { HomeItem, HomeModule } from '../home-types'
import { HomeItemDialog } from './home-item-dialog'
import { HomeModuleColumn } from './home-module-column'

interface SelectedHomeItem {
  item: HomeItem
  moduleTitle: string
}

interface HomeBoardProps {
  modules: HomeModule[]
}

export function HomeBoard({ modules }: HomeBoardProps) {
  const [selected, setSelected] = useState<SelectedHomeItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null)

  return (
    <>
      <section
        tabIndex={0}
        aria-label="BereCat modülleri"
        className="home-board-scroll min-h-[calc(100dvh-8.5rem)] overflow-x-auto p-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-gold)] sm:p-4"
      >
        <div className="flex min-w-max items-start gap-3 pb-3">
          {modules.map((module) => (
            <HomeModuleColumn
              key={module.id}
              module={module}
              onSelectItem={(item, trigger) => {
                selectedTriggerRef.current = trigger
                setSelected({ item, moduleTitle: module.title })
                setDialogOpen(true)
              }}
            />
          ))}
        </div>
      </section>

      <HomeItemDialog
        open={dialogOpen}
        selected={selected}
        onOpenChange={setDialogOpen}
        returnFocus={() => selectedTriggerRef.current?.focus()}
      />
    </>
  )
}
