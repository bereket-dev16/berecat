import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WORK_ITEM_MODULES } from '../../work-items/work-item-constants'
import type { HomeItem, HomeModule } from '../home-types'

interface MockDragOperation {
  source?: { id?: string; data?: unknown }
  target?: { id?: string; data?: unknown }
}

interface MockDragStartEvent {
  operation: MockDragOperation
}

interface MockDragEndEvent extends MockDragStartEvent {
  canceled: boolean
}

interface MockAccessibilityOptions {
  announcements?: {
    dragstart?: (event: MockDragStartEvent) => string | undefined
    dragover?: (event: MockDragStartEvent) => string | undefined
    dragend?: (event: MockDragEndEvent) => string | undefined
  }
  screenReaderInstructions?: { draggable: string }
}

interface MockProviderProps {
  plugins?: (defaults: unknown[]) => unknown[]
  sensors?: unknown[]
  onDragStart?: (event: MockDragStartEvent) => void
  onDragEnd?: (event: MockDragEndEvent) => void
}

interface MockSensorOptions {
  activationConstraints?: unknown[]
  offset?: number | { x: number; y: number }
  preventActivation?: (event: { target: EventTarget | null }) => boolean
}

const dndKitMock = vi.hoisted(() => {
  class Distance {
    readonly options: { value: number }

    constructor(options: { value: number }) {
      this.options = options
    }
  }

  const pointerSensor = { kind: 'pointer-sensor' }
  const keyboardSensor = { kind: 'keyboard-sensor' }
  const accessibilityPlugin = { kind: 'turkish-accessibility-plugin' }
  const accessibilityConfigure = vi.fn((options: MockAccessibilityOptions) => {
    void options
    return accessibilityPlugin
  })
  const Accessibility = {
    configure: accessibilityConfigure,
    kind: 'default-accessibility-plugin',
  }
  const pointerConfigure = vi.fn((options: MockSensorOptions) => {
    void options
    return pointerSensor
  })
  const keyboardConfigure = vi.fn((options: MockSensorOptions) => {
    void options
    return keyboardSensor
  })

  return {
    Accessibility,
    Distance,
    accessibilityConfigure,
    accessibilityPlugin,
    keyboardConfigure,
    keyboardSensor,
    pointerConfigure,
    pointerSensor,
    providerProps: null as MockProviderProps | null,
  }
})

vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: ({
    children,
    ...props
  }: MockProviderProps & { children: ReactNode }) => {
    dndKitMock.providerProps = props
    return children
  },
  DragOverlay: ({ children }: { children: ReactNode }) => children,
  useDraggable: vi.fn(() => ({
    isDragging: false,
    ref: vi.fn(),
  })),
  useDroppable: vi.fn(() => ({
    isDropTarget: false,
    ref: vi.fn(),
  })),
}))

vi.mock('@dnd-kit/dom', () => ({
  Accessibility: dndKitMock.Accessibility,
  KeyboardSensor: {
    configure: dndKitMock.keyboardConfigure,
  },
  PointerActivationConstraints: {
    Distance: dndKitMock.Distance,
  },
  PointerSensor: {
    configure: dndKitMock.pointerConfigure,
  },
}))

import { HomeBoard } from './home-board'

const workItem: HomeItem = {
  id: '20000000-0000-4000-8000-000000000001',
  title: 'Deneme Ürünü',
  companyName: 'Örnek Firma',
  description: 'Sürükle bırak testi.',
  dueDate: '2026-10-15',
  status: 'active',
  completedAt: null,
  assignees: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      displayName: 'Deniz',
    },
  ],
}

const fetchMock = vi.fn<typeof fetch>()

function makeModules(): HomeModule[] {
  return WORK_ITEM_MODULES.map((module) => ({
    id: module.key,
    title: module.title,
    items: module.key === 'incoming-orders' ? [workItem] : [],
  }))
}

function createDeferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function getProviderProps(): Required<
  Pick<MockProviderProps, 'onDragEnd' | 'onDragStart' | 'sensors'>
> {
  const props = dndKitMock.providerProps

  if (!props?.onDragEnd || !props.onDragStart || !props.sensors) {
    throw new Error('Sürükle bırak sağlayıcısı hazır değil.')
  }

  return {
    onDragEnd: props.onDragEnd,
    onDragStart: props.onDragStart,
    sensors: props.sensors,
  }
}

function dragEndEvent(
  sourceModuleKey: HomeModule['id'],
  targetModuleKey: HomeModule['id'],
): MockDragEndEvent {
  return {
    canceled: false,
    operation: {
      source: {
        data: { item: workItem, moduleKey: sourceModuleKey },
      },
      target: {
        data: { moduleKey: targetModuleKey },
      },
    },
  }
}

function renderBoard() {
  const onBoardRefresh = vi.fn()
  const onCreated = vi.fn()
  const onUnauthorized = vi.fn()

  const board = (modules: HomeModule[]) => (
    <MemoryRouter>
      <HomeBoard
        modules={modules}
        onBoardRefresh={onBoardRefresh}
        onCreated={onCreated}
        onUnauthorized={onUnauthorized}
      />
    </MemoryRouter>
  )
  const renderResult = render(board(makeModules()))

  return {
    onBoardRefresh,
    onCreated,
    onUnauthorized,
    rerenderBoard: (modules: HomeModule[]) => renderResult.rerender(board(modules)),
  }
}

function expectItemInModule(
  moduleKey: HomeModule['id'],
  isPresent: boolean,
) {
  const module = screen.getByTestId(`work-item-module-${moduleKey}`)
  const card = within(module).queryByTestId(`work-item-card-${workItem.id}`)

  if (isPresent) {
    expect(card).toBeInTheDocument()
  } else {
    expect(card).not.toBeInTheDocument()
  }
}

describe('Phase 02C HomeBoard sürükle bırak davranışı', () => {
  beforeEach(() => {
    dndKitMock.providerProps = null
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('kartı başka kolona optimistic taşır, doğru modül anahtarını gönderir ve panoyu yeniler', async () => {
    const deferredMove = createDeferredResponse()
    fetchMock.mockReturnValue(deferredMove.promise)
    const { onBoardRefresh } = renderBoard()

    act(() => {
      getProviderProps().onDragEnd(
        dragEndEvent('incoming-orders', 'new-designs'),
      )
    })

    expectItemInModule('incoming-orders', false)
    expectItemInModule('new-designs', true)
    expect(onBoardRefresh).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/work-items/${workItem.id}/move`,
      expect.objectContaining({
        body: JSON.stringify({ moduleKey: 'new-designs' }),
        credentials: 'include',
        method: 'POST',
      }),
    )

    await act(async () => {
      deferredMove.resolve(new Response(null, { status: 200 }))
      await deferredMove.promise
    })

    await waitFor(() => expect(onBoardRefresh).toHaveBeenCalledTimes(1))
    expectItemInModule('new-designs', true)
  })

  it('aynı kolona bırakıldığında taşıma endpointini çağırmaz', () => {
    const { onBoardRefresh } = renderBoard()

    act(() => {
      getProviderProps().onDragEnd(
        dragEndEvent('incoming-orders', 'incoming-orders'),
      )
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(onBoardRefresh).not.toHaveBeenCalled()
    expectItemInModule('incoming-orders', true)
  })

  it('taşıma başarısız olursa kartı eski kolona geri alır ve güvenli hata gösterir', async () => {
    const deferredMove = createDeferredResponse()
    fetchMock.mockReturnValue(deferredMove.promise)
    const { onBoardRefresh, onUnauthorized } = renderBoard()

    act(() => {
      getProviderProps().onDragEnd(
        dragEndEvent('incoming-orders', 'new-designs'),
      )
    })

    expectItemInModule('incoming-orders', false)
    expectItemInModule('new-designs', true)

    await act(async () => {
      deferredMove.resolve(
        new Response(JSON.stringify({ message: 'Sunucu hatası.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      await deferredMove.promise
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('İş aktarılamadı.')
    })
    expectItemInModule('incoming-orders', true)
    expectItemInModule('new-designs', false)
    expect(onBoardRefresh).not.toHaveBeenCalled()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('optimistic taşınan kartı tamamlarken gizler, hatada hedef kolona döndürür ve başarıda stale override bırakmaz', async () => {
    const deferredMove = createDeferredResponse()
    const deferredFailedCompletion = createDeferredResponse()
    const deferredSuccessfulCompletion = createDeferredResponse()
    fetchMock
      .mockReturnValueOnce(deferredMove.promise)
      .mockReturnValueOnce(deferredFailedCompletion.promise)
      .mockReturnValueOnce(deferredSuccessfulCompletion.promise)
    const { onBoardRefresh, rerenderBoard } = renderBoard()

    act(() => {
      getProviderProps().onDragEnd(
        dragEndEvent('incoming-orders', 'new-designs'),
      )
    })

    await act(async () => {
      deferredMove.resolve(new Response(null, { status: 200 }))
      await deferredMove.promise
    })
    await waitFor(() => expect(onBoardRefresh).toHaveBeenCalledTimes(1))

    act(() => {
      within(screen.getByTestId('work-item-module-new-designs'))
        .getByRole('button', { name: 'İşi tamamla' })
        .click()
    })

    expectItemInModule('incoming-orders', false)
    expectItemInModule('new-designs', false)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/work-items/${workItem.id}/complete`,
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )

    await act(async () => {
      deferredFailedCompletion.resolve(
        new Response(JSON.stringify({ message: 'Sunucu hatası.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      await deferredFailedCompletion.promise
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('İş tamamlanamadı.')
    })
    expectItemInModule('incoming-orders', false)
    expectItemInModule('new-designs', true)
    expect(onBoardRefresh).toHaveBeenCalledTimes(1)

    act(() => {
      within(screen.getByTestId('work-item-module-new-designs'))
        .getByRole('button', { name: 'İşi tamamla' })
        .click()
    })

    expectItemInModule('incoming-orders', false)
    expectItemInModule('new-designs', false)

    await act(async () => {
      deferredSuccessfulCompletion.resolve(new Response(null, { status: 200 }))
      await deferredSuccessfulCompletion.promise
    })
    await waitFor(() => expect(onBoardRefresh).toHaveBeenCalledTimes(2))

    act(() => {
      rerenderBoard(
        makeModules().map((module) => ({ ...module, items: [] })),
      )
    })
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expectItemInModule('incoming-orders', false)
    expectItemInModule('new-designs', false)
  })

  it('sürükleme başladığında kart önizlemesini DragOverlay içinde gösterir', () => {
    renderBoard()

    act(() => {
      getProviderProps().onDragStart({
        operation: {
          source: {
            data: { item: workItem, moduleKey: 'incoming-orders' },
          },
        },
      })
    })

    expect(screen.getByTestId('work-item-drag-overlay')).toHaveTextContent(
      workItem.title,
    )
  })

  it('varsayılan pluginlerden yalnız Accessibility öğesini Türkçe yapılandırmayla değiştirir', () => {
    renderBoard()
    const plugins = dndKitMock.providerProps?.plugins
    const accessibilityOptions =
      dndKitMock.accessibilityConfigure.mock.calls.at(0)?.[0]

    if (!plugins || !accessibilityOptions?.announcements) {
      throw new Error('Erişilebilirlik yapılandırması hazır değil.')
    }

    const otherPlugins = [
      { kind: 'auto-scroller-plugin' },
      { kind: 'cursor-plugin' },
      { kind: 'feedback-plugin' },
    ]
    const defaults = [dndKitMock.Accessibility, ...otherPlugins]

    expect(plugins(defaults)).toEqual([
      dndKitMock.accessibilityPlugin,
      ...otherPlugins,
    ])
    expect(accessibilityOptions.screenReaderInstructions).toEqual({
      draggable:
        'Kartı almak için Boşluk veya Enter tuşuna basın. Sol ve Sağ Ok ile birim seçin. Boşluk veya Enter ile bırakın, Escape ile iptal edin.',
    })

    const { dragstart, dragover, dragend } = accessibilityOptions.announcements

    if (!dragstart || !dragover || !dragend) {
      throw new Error('Türkçe sürükleme duyuruları hazır değil.')
    }

    const source = {
      id: workItem.id,
      data: { item: workItem, moduleKey: 'incoming-orders' },
    }
    const target = {
      id: 'module:new-designs',
      data: { moduleKey: 'new-designs' },
    }

    expect(dragstart({ operation: { source } })).toBe(
      'Deneme Ürünü kartı alındı.',
    )
    expect(dragover({ operation: { source, target } })).toBe(
      'Deneme Ürünü kartı, Yeni Tasarımlar birimi üzerinde.',
    )
    expect(dragover({ operation: { source } })).toBe(
      'Deneme Ürünü kartı bırakma alanı dışında.',
    )
    expect(dragend({ operation: { source, target }, canceled: false })).toBe(
      'Deneme Ürünü kartı, Yeni Tasarımlar birimine bırakıldı.',
    )
    expect(dragend({ operation: { source, target }, canceled: true })).toBe(
      'Deneme Ürünü kartının taşınması iptal edildi.',
    )
  })

  it('pointer ve klavye sensörlerini yapılandırır, kart aksiyonlarında aktivasyonu engeller', () => {
    renderBoard()
    const { sensors } = getProviderProps()
    const pointerOptions = dndKitMock.pointerConfigure.mock.calls.at(0)?.[0]
    const keyboardOptions = dndKitMock.keyboardConfigure.mock.calls.at(0)?.[0]

    expect(sensors).toEqual([
      dndKitMock.pointerSensor,
      dndKitMock.keyboardSensor,
    ])
    expect(pointerOptions?.activationConstraints?.at(0)).toEqual(
      expect.objectContaining({ options: { value: 8 } }),
    )
    expect(keyboardOptions?.offset).toEqual({ x: 276, y: 10 })

    if (!pointerOptions?.preventActivation || !keyboardOptions?.preventActivation) {
      throw new Error('Sensör aktivasyon engeli yapılandırılmadı.')
    }

    for (const actionName of ['İşi çoğalt', 'İşi tamamla']) {
      const action = screen.getByRole('button', { name: actionName })

      expect(pointerOptions.preventActivation({ target: action })).toBe(true)
      expect(keyboardOptions.preventActivation({ target: action })).toBe(true)
    }

    const card = screen.getByTestId(`work-item-card-${workItem.id}`)
    expect(card).toHaveAttribute(
      'aria-roledescription',
      'sürüklenebilir iş kartı',
    )
    expect(
      screen
        .getByText(/Boşluk veya Enter ile bırakın, Escape ile iptal edin/)
        .classList.contains('sr-only'),
    ).toBe(true)
    expect(pointerOptions.preventActivation({ target: card })).toBe(false)
    expect(keyboardOptions.preventActivation({ target: card })).toBe(false)
  })
})
