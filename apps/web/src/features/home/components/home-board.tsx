import { DragDropProvider, DragOverlay } from '@dnd-kit/react'
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/react'
import {
  Accessibility,
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from '@dnd-kit/dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { CreateWorkItemDialog } from '../../work-items/components/create-work-item-dialog'
import { DeleteWorkItemDialog } from '../../work-items/components/delete-work-item-dialog'
import {
  completeWorkItem,
  getWorkItemDetail,
  isWorkItemRequestError,
  moveWorkItem,
} from '../../work-items/work-item-api'
import {
  getWorkItemModuleTitle,
  isWorkItemModuleKey,
} from '../../work-items/work-item-constants'
import type { WorkItemDetail } from '../../work-items/work-item-types'
import type { HomeItem, HomeModule } from '../home-types'
import type { HomeItemDragData } from './home-item-card'
import { HomeItemDialog } from './home-item-dialog'
import { HomeModuleColumn } from './home-module-column'

interface SelectedHomeItem {
  item: HomeItem
  moduleTitle: string
}

interface OptimisticMove {
  item: HomeItem
  targetModuleKey: HomeModule['id']
}

type DndPlugins = (typeof import('@dnd-kit/dom').defaultPreset)['plugins']

interface HomeBoardProps {
  modules: HomeModule[]
  onBoardRefresh: () => void
  onCreated: () => void
  onUnauthorized: () => void
}

const pointerSensor = PointerSensor.configure({
  activationConstraints: [
    new PointerActivationConstraints.Distance({ value: 8 }),
  ],
  preventActivation: (event) =>
    event.target instanceof Element &&
    event.target.closest('[data-no-drag]') !== null,
})

const keyboardSensor = KeyboardSensor.configure({
  offset: { x: 276, y: 10 },
  preventActivation: (event) =>
    event.target instanceof Element &&
    event.target.closest('[data-no-drag]') !== null,
})

function isHomeItemDragData(value: unknown): value is HomeItemDragData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<HomeItemDragData>
  return (
    typeof candidate.item?.id === 'string' &&
    isWorkItemModuleKey(candidate.moduleKey)
  )
}

function getDraggedItemTitle(data: unknown): string {
  return isHomeItemDragData(data) ? data.item.title : 'İş'
}

function getDropTargetTitle(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }

  const moduleKey = (data as { moduleKey?: unknown }).moduleKey
  return isWorkItemModuleKey(moduleKey)
    ? getWorkItemModuleTitle(moduleKey)
    : null
}

const turkishAccessibilityPlugin = Accessibility.configure({
  screenReaderInstructions: {
    draggable:
      'Kartı almak için Boşluk veya Enter tuşuna basın. Sol ve Sağ Ok ile birim seçin. Boşluk veya Enter ile bırakın, Escape ile iptal edin.',
  },
  announcements: {
    dragstart(event: DragStartEvent) {
      const source = event.operation.source
      return source
        ? `${getDraggedItemTitle(source.data)} kartı alındı.`
        : undefined
    },
    dragover(event: DragOverEvent) {
      const { source, target } = event.operation

      if (!source || source.id === target?.id) {
        return undefined
      }

      const itemTitle = getDraggedItemTitle(source.data)
      const targetTitle = target && getDropTargetTitle(target.data)

      if (!target) {
        return `${itemTitle} kartı bırakma alanı dışında.`
      }

      return targetTitle
        ? `${itemTitle} kartı, ${targetTitle} birimi üzerinde.`
        : `${itemTitle} kartı bir bırakma alanı üzerinde.`
    },
    dragend(event: DragEndEvent) {
      const { source, target } = event.operation

      if (!source) {
        return undefined
      }

      const itemTitle = getDraggedItemTitle(source.data)

      if (event.canceled) {
        return `${itemTitle} kartının taşınması iptal edildi.`
      }

      const targetTitle = target && getDropTargetTitle(target.data)
      return targetTitle
        ? `${itemTitle} kartı, ${targetTitle} birimine bırakıldı.`
        : `${itemTitle} kartı geçerli bir birime bırakılmadı.`
    },
  },
})

function withTurkishAccessibility(defaultPlugins: DndPlugins): DndPlugins {
  return defaultPlugins.map((plugin) =>
    plugin === Accessibility ? turkishAccessibilityPlugin : plugin,
  )
}

function applyBoardOverrides(
  modules: HomeModule[],
  hiddenItemIds: ReadonlySet<string>,
  optimisticMoves: Readonly<Record<string, OptimisticMove>>,
): HomeModule[] {
  const visibleModules = modules.map((module) => ({
    ...module,
    items: module.items.filter(
      (item) => item.status === 'active' && !hiddenItemIds.has(item.id),
    ),
  }))

  for (const [itemId, move] of Object.entries(optimisticMoves)) {
    if (hiddenItemIds.has(itemId)) {
      continue
    }

    for (const module of visibleModules) {
      module.items = module.items.filter((item) => item.id !== itemId)
    }

    const targetModule = visibleModules.find(
      (module) => module.id === move.targetModuleKey,
    )
    targetModule?.items.unshift(move.item)
  }

  return visibleModules
}

export function HomeBoard({
  modules,
  onBoardRefresh,
  onCreated,
  onUnauthorized,
}: HomeBoardProps) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<SelectedHomeItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const selectedTriggerRef = useRef<HTMLElement | null>(null)
  const [createModule, setCreateModule] = useState<HomeModule | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogSession, setCreateDialogSession] = useState(0)
  const [createMode, setCreateMode] = useState<
    'create' | 'duplicate' | 'edit'
  >('create')
  const [duplicateSource, setDuplicateSource] =
    useState<WorkItemDetail | null>(null)
  const [formInitialLoading, setFormInitialLoading] = useState(false)
  const createTriggerRef = useRef<HTMLElement | null>(null)
  const formRequestIdRef = useRef(0)
  const [activeDragItem, setActiveDragItem] = useState<HomeItem | null>(null)
  const [optimisticMoves, setOptimisticMoves] = useState<
    Record<string, OptimisticMove>
  >({})
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(
    () => new Set(),
  )
  const moveInFlightRef = useRef(false)
  const [completingItemId, setCompletingItemId] = useState<string | null>(null)
  const completionInFlightRef = useRef(false)
  const [duplicatingItemId, setDuplicatingItemId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HomeItem | null>(null)
  const deleteTriggerRef = useRef<HTMLElement | null>(null)
  const [boardMessage, setBoardMessage] = useState<string | null>(null)

  const renderedModules = useMemo(
    () => applyBoardOverrides(modules, hiddenItemIds, optimisticMoves),
    [hiddenItemIds, modules, optimisticMoves],
  )

  useEffect(() => {
    const confirmedMoveIds = Object.entries(optimisticMoves)
      .filter(([itemId, move]) =>
        modules.some(
          (module) =>
            module.id === move.targetModuleKey &&
            module.items.some((item) => item.id === itemId),
        ),
      )
      .map(([itemId]) => itemId)
    const confirmedCompletionIds = [...hiddenItemIds].filter(
      (itemId) =>
        !modules.some((module) =>
          module.items.some((item) => item.id === itemId),
        ),
    )

    if (confirmedMoveIds.length === 0 && confirmedCompletionIds.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      if (confirmedMoveIds.length > 0) {
        setOptimisticMoves((current) => {
          const next = { ...current }
          for (const itemId of confirmedMoveIds) {
            delete next[itemId]
          }
          return next
        })
      }

      if (confirmedCompletionIds.length > 0) {
        setHiddenItemIds((current) => {
          const next = new Set(current)
          for (const itemId of confirmedCompletionIds) {
            next.delete(itemId)
          }
          return next
        })
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [hiddenItemIds, modules, optimisticMoves])

  function handleDragStart(event: DragStartEvent) {
    const data = event.operation.source?.data
    setBoardMessage(null)
    setActiveDragItem(isHomeItemDragData(data) ? data.item : null)
  }

  async function moveItem(
    item: HomeItem,
    sourceModuleKey: HomeModule['id'],
    targetModuleKey: HomeModule['id'],
  ) {
    if (
      sourceModuleKey === targetModuleKey ||
      moveInFlightRef.current ||
      completionInFlightRef.current
    ) {
      return
    }

    moveInFlightRef.current = true
    setBoardMessage(null)
    setOptimisticMoves((current) => ({
      ...current,
      [item.id]: { item, targetModuleKey },
    }))

    try {
      await moveWorkItem(item.id, targetModuleKey)
      onBoardRefresh()
    } catch (error: unknown) {
      setOptimisticMoves((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })

      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setBoardMessage('İş aktarılamadı.')
    } finally {
      moveInFlightRef.current = false
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragItem(null)

    if (event.canceled) {
      return
    }

    const sourceData = event.operation.source?.data
    const targetData = event.operation.target?.data

    if (
      !isHomeItemDragData(sourceData) ||
      typeof targetData !== 'object' ||
      targetData === null ||
      !isWorkItemModuleKey(targetData.moduleKey)
    ) {
      return
    }

    void moveItem(
      sourceData.item,
      sourceData.moduleKey,
      targetData.moduleKey,
    )
  }

  async function handleComplete(item: HomeItem) {
    if (completionInFlightRef.current || moveInFlightRef.current) {
      return
    }

    completionInFlightRef.current = true
    setBoardMessage(null)
    setCompletingItemId(item.id)
    setHiddenItemIds((current) => new Set(current).add(item.id))

    try {
      await completeWorkItem(item.id)
      setOptimisticMoves((current) => {
        if (!current[item.id]) {
          return current
        }

        const next = { ...current }
        delete next[item.id]
        return next
      })
      onBoardRefresh()
    } catch (error: unknown) {
      setHiddenItemIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })

      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setBoardMessage('İş tamamlanamadı.')
    } finally {
      completionInFlightRef.current = false
      setCompletingItemId(null)
    }
  }

  async function handleDuplicate(item: HomeItem, trigger?: HTMLElement) {
    if (
      duplicatingItemId ||
      completionInFlightRef.current ||
      moveInFlightRef.current
    ) {
      return
    }

    setBoardMessage(null)
    setDuplicatingItemId(item.id)
    createTriggerRef.current =
      trigger ?? (document.activeElement as HTMLElement)

    try {
      const detail = await getWorkItemDetail(item.id)
      const incomingModule = modules.find(
        (module) => module.id === 'incoming-orders',
      )

      if (!incomingModule) {
        setBoardMessage('İş bilgileri yüklenemedi.')
        return
      }

      setDuplicateSource(detail)
      setCreateModule(incomingModule)
      setCreateMode('duplicate')
      setCreateDialogSession((session) => session + 1)
      setCreateDialogOpen(true)
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setBoardMessage('İş bilgileri yüklenemedi.')
    } finally {
      setDuplicatingItemId(null)
    }
  }

  async function handleEdit(item: HomeItem, trigger: HTMLElement) {
    if (
      editingItemId ||
      duplicatingItemId ||
      completionInFlightRef.current ||
      moveInFlightRef.current
    ) {
      return
    }

    const module = modules.find((candidate) =>
      candidate.items.some((candidateItem) => candidateItem.id === item.id),
    )

    if (!module) {
      setBoardMessage('İş bilgileri yüklenemedi.')
      return
    }

    const requestId = formRequestIdRef.current + 1
    formRequestIdRef.current = requestId
    setBoardMessage(null)
    setEditingItemId(item.id)
    createTriggerRef.current = trigger
    setCreateModule(module)
    setDuplicateSource(null)
    setCreateMode('edit')
    setFormInitialLoading(true)
    setCreateDialogSession((session) => session + 1)
    setCreateDialogOpen(true)

    try {
      const detail = await getWorkItemDetail(item.id)

      if (formRequestIdRef.current !== requestId) {
        return
      }

      const currentModule = modules.find(
        (candidate) => candidate.id === detail.moduleKey,
      )
      if (currentModule) {
        setCreateModule(currentModule)
      }
      setDuplicateSource(detail)
      setFormInitialLoading(false)
    } catch (error: unknown) {
      if (formRequestIdRef.current !== requestId) {
        return
      }

      setCreateDialogOpen(false)
      setFormInitialLoading(false)

      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setBoardMessage('İş bilgileri yüklenemedi.')
    } finally {
      if (formRequestIdRef.current === requestId) {
        setEditingItemId(null)
      }
    }
  }

  function handleFormDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      formRequestIdRef.current += 1
      setFormInitialLoading(false)
      setEditingItemId(null)
    }

    setCreateDialogOpen(nextOpen)
  }

  return (
    <>
      <DragDropProvider
        plugins={withTurkishAccessibility}
        sensors={[pointerSensor, keyboardSensor]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <section
          tabIndex={0}
          aria-label="BereCat modülleri"
          className="home-board-scroll min-h-[calc(100dvh-8.5rem)] overflow-x-auto p-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-gold)] sm:p-4"
        >
          {boardMessage ? (
            <div
              role="alert"
              className="mb-3 rounded-md border border-[var(--brand-orange)]/45 bg-black/20 px-4 py-3 text-sm font-semibold text-[#ffad7d]"
            >
              {boardMessage}
            </div>
          ) : null}

          <div className="flex min-w-max items-start gap-3 pb-3">
            {renderedModules.map((module) => (
              <HomeModuleColumn
                key={module.id}
                module={module}
                completingItemId={completingItemId}
                duplicatingItemId={duplicatingItemId}
                editingItemId={editingItemId}
                deletingItemId={deleteTarget?.id ?? null}
                onCreateItem={(selectedModule, trigger) => {
                  createTriggerRef.current = trigger
                  setCreateModule(selectedModule)
                  setDuplicateSource(null)
                  setCreateMode('create')
                  setFormInitialLoading(false)
                  setCreateDialogSession((session) => session + 1)
                  setCreateDialogOpen(true)
                }}
                onSelectItem={(item, trigger) => {
                  selectedTriggerRef.current = trigger
                  setSelected({ item, moduleTitle: module.title })
                  setDialogOpen(true)
                }}
                onCompleteItem={(item) => void handleComplete(item)}
                onDuplicateItem={(item) =>
                  void handleDuplicate(item, document.activeElement as HTMLElement)
                }
                onEditItem={(item, trigger) => void handleEdit(item, trigger)}
                onDeleteItem={(item, trigger) => {
                  setBoardMessage(null)
                  deleteTriggerRef.current = trigger
                  setDeleteTarget(item)
                }}
              />
            ))}
          </div>
        </section>

        <DragOverlay dropAnimation={null}>
          {activeDragItem ? (
            <div
              data-testid="work-item-drag-overlay"
              className="w-64 rounded-lg border border-[var(--brand-gold)]/65 bg-[var(--card-olive)] px-3.5 py-3 text-sm font-semibold text-white shadow-xl"
            >
              {activeDragItem.title}
            </div>
          ) : null}
        </DragOverlay>
      </DragDropProvider>

      <HomeItemDialog
        open={dialogOpen}
        selected={selected}
        onOpenChange={setDialogOpen}
        onUnauthorized={onUnauthorized}
        returnFocus={() => selectedTriggerRef.current?.focus()}
        onGoToDetail={(workItemId) => {
          setDialogOpen(false)
          navigate(`/isler/${workItemId}`)
        }}
      />

      <CreateWorkItemDialog
        key={`${createDialogSession}:${duplicateSource?.id ?? 'empty'}`}
        open={createDialogOpen}
        module={createModule}
        mode={createMode}
        initialWorkItem={duplicateSource}
        initialLoading={formInitialLoading}
        onOpenChange={handleFormDialogOpenChange}
        onCreated={onCreated}
        onUnauthorized={onUnauthorized}
        returnFocus={() => createTriggerRef.current?.focus()}
      />

      {deleteTarget ? (
        <DeleteWorkItemDialog
          key={deleteTarget.id}
          open
          workItem={deleteTarget}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDeleteTarget(null)
            }
          }}
          onDeleted={(workItemId) => {
            setHiddenItemIds((current) => new Set(current).add(workItemId))
            setDeleteTarget(null)
            onBoardRefresh()
          }}
          onUnauthorized={onUnauthorized}
          returnFocus={() => deleteTriggerRef.current?.focus()}
        />
      ) : null}
    </>
  )
}
