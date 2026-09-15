import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import App from '../../App'
import type { AuthUser } from '../auth/auth-types'
import type { HomeItem, HomeOverview } from '../home/home-types'
import { WORK_ITEM_MODULES } from './work-item-constants'
import type {
  CreatedWorkItemComment,
  UserOption,
  WorkItemAssignee,
  WorkItemComment,
  WorkItemDetail,
  WorkItemEvent,
} from './work-item-types'

const authenticatedUser: AuthUser = {
  id: '10000000-0000-4000-8000-000000000001',
  username: 'deniz',
  displayName: 'Deniz',
  role: 'member',
  team: 'graphic',
}

const secondUser: UserOption = {
  id: '10000000-0000-4000-8000-000000000002',
  username: 'selin',
  displayName: 'Selin',
  role: 'member',
  team: 'digital',
}

const userOptions: UserOption[] = [authenticatedUser, secondUser]

const authenticatedAssignee: WorkItemAssignee = {
  id: authenticatedUser.id,
  username: authenticatedUser.username,
  displayName: authenticatedUser.displayName,
  team: authenticatedUser.team,
}

const secondAssignee: WorkItemAssignee = {
  id: secondUser.id,
  username: secondUser.username,
  displayName: secondUser.displayName,
  team: secondUser.team,
}

const workItemId = '20000000-0000-4000-8000-000000000001'

function makeHomeItem(overrides: Partial<HomeItem> = {}): HomeItem {
  return {
    id: workItemId,
    title: 'Deneme Ürünü',
    companyName: 'Örnek Firma',
    description: 'Yalnızca test amacıyla kullanılan açıklama.',
    dueDate: '2026-10-15',
    status: 'active',
    completedAt: null,
    assignees: [
      { id: authenticatedUser.id, displayName: authenticatedUser.displayName },
    ],
    ...overrides,
  }
}

function makeOverview(items: HomeItem[] = [makeHomeItem()]): HomeOverview {
  return {
    modules: WORK_ITEM_MODULES.map((module) => ({
      id: module.key,
      title: module.title,
      items: module.key === 'incoming-orders' ? items : [],
    })),
  }
}

function makeOverviewForModule(
  moduleKey: WorkItemDetail['moduleKey'],
  items: HomeItem[],
): HomeOverview {
  return {
    modules: WORK_ITEM_MODULES.map((module) => ({
      id: module.key,
      title: module.title,
      items: module.key === moduleKey ? items : [],
    })),
  }
}

function makeDetail(
  overrides: Partial<WorkItemDetail> = {},
): WorkItemDetail {
  return {
    id: workItemId,
    moduleKey: 'incoming-orders',
    moduleTitle: 'Gelen Siparişler',
    orderCode: 'SIP-TEST',
    companyName: 'Örnek Firma',
    productName: 'Deneme Ürünü',
    packagingType: 'Kutu',
    supplierCompany: 'Örnek Tedarikçi',
    orderType: 'Standart',
    stockValue: 'Mevcut',
    needOrderValue: 'Gerekli',
    orderedQuantity: 'On koli',
    receivedQuantity: 'Beş koli',
    orderReceivedDate: '2026-09-01',
    orderPlacedDate: '2026-09-02',
    orderDeadlineDate: '2026-10-15',
    orderShipmentDate: null,
    processStage: 'Hazırlık',
    productDetail: 'Test kapsamındaki ürün detayı.',
    status: 'active',
    completedAt: null,
    completedBy: null,
    assignees: [authenticatedAssignee],
    createdBy: {
      id: authenticatedUser.id,
      displayName: authenticatedUser.displayName,
      username: authenticatedUser.username,
    },
    createdAt: '2026-09-14T08:00:00.000Z',
    updatedAt: '2026-09-14T09:30:00.000Z',
    comments: [],
    events: [],
    ...overrides,
  }
}

interface ApiScenario {
  getOverview?: (requestNumber: number) => HomeOverview
  getDetail?: (requestNumber: number) => WorkItemDetail
  getDetailResponse?: (requestNumber: number) => Response | Promise<Response>
  detailStatus?: number
  onCreate?: (body: unknown) => Response | Promise<Response>
  onUpdate?: (body: unknown) => Response | Promise<Response>
  onDelete?: (body: unknown) => Response | Promise<Response>
  onAssign?: (body: unknown) => Response
  onClaim?: () => Response
  onComment?: (body: unknown) => Response | Promise<Response>
  onReaction?: (
    commentId: string,
    method: 'PUT' | 'DELETE',
  ) => Response | Promise<Response>
  onMove?: (body: unknown) => Response
  onComplete?: () => Response | Promise<Response>
  onReopen?: () => Response
  onMasterDataSuggestions?: (
    url: URL,
    init: RequestInit | undefined,
  ) => Response | Promise<Response>
}

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createDeferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function readRequestBody(init?: RequestInit): unknown {
  return typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
}

function installAuthenticatedApi(scenario: ApiScenario = {}) {
  let overviewRequestCount = 0
  let detailRequestCount = 0

  fetchMock.mockImplementation((input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const method = init?.method ?? 'GET'

    if (url === '/api/auth/session' && method === 'GET') {
      return Promise.resolve(jsonResponse({ user: authenticatedUser }))
    }

    if (url === '/api/home/overview' && method === 'GET') {
      overviewRequestCount += 1
      const overview = scenario.getOverview
        ? scenario.getOverview(overviewRequestCount)
        : makeOverview()
      return Promise.resolve(jsonResponse(overview))
    }

    if (url === '/api/users/options' && method === 'GET') {
      return Promise.resolve(jsonResponse({ users: userOptions }))
    }

    if (url.startsWith('/api/master-data/suggestions?') && method === 'GET') {
      return Promise.resolve(
        scenario.onMasterDataSuggestions?.(
          new URL(url, 'http://localhost'),
          init,
        ) ?? jsonResponse({ suggestions: [] }),
      )
    }

    if (url === '/api/work-items' && method === 'POST') {
      return Promise.resolve(
        scenario.onCreate?.(readRequestBody(init)) ??
          jsonResponse({ workItem: makeHomeItem() }, 201),
      )
    }

    if (url === `/api/work-items/${workItemId}` && method === 'GET') {
      detailRequestCount += 1

      if (scenario.getDetailResponse) {
        return Promise.resolve(scenario.getDetailResponse(detailRequestCount))
      }

      if (scenario.detailStatus) {
        return Promise.resolve(
          jsonResponse({ message: 'İş isteği tamamlanamadı.' }, scenario.detailStatus),
        )
      }

      return Promise.resolve(
        jsonResponse({
          workItem: scenario.getDetail?.(detailRequestCount) ?? makeDetail(),
        }),
      )
    }

    if (url === `/api/work-items/${workItemId}` && method === 'PATCH') {
      return Promise.resolve(
        scenario.onUpdate?.(readRequestBody(init)) ??
          jsonResponse({ workItem: makeHomeItem() }),
      )
    }

    if (url === `/api/work-items/${workItemId}` && method === 'DELETE') {
      return Promise.resolve(
        scenario.onDelete?.(readRequestBody(init)) ?? new Response(null, { status: 204 }),
      )
    }

    if (
      url === `/api/work-items/${workItemId}/move` &&
      method === 'POST'
    ) {
      return Promise.resolve(
        scenario.onMove?.(readRequestBody(init)) ??
          jsonResponse({ workItem: makeHomeItem() }),
      )
    }

    if (
      url === `/api/work-items/${workItemId}/complete` &&
      method === 'POST'
    ) {
      return Promise.resolve(
        scenario.onComplete?.() ?? jsonResponse({ workItem: makeHomeItem() }),
      )
    }

    if (
      url === `/api/work-items/${workItemId}/reopen` &&
      method === 'POST'
    ) {
      return Promise.resolve(
        scenario.onReopen?.() ?? jsonResponse({ workItem: makeHomeItem() }),
      )
    }

    if (
      url === `/api/work-items/${workItemId}/assignees` &&
      method === 'PUT'
    ) {
      return Promise.resolve(
        scenario.onAssign?.(readRequestBody(init)) ??
          jsonResponse({ assignees: [authenticatedAssignee] }),
      )
    }

    if (
      url === `/api/work-items/${workItemId}/claim` &&
      method === 'POST'
    ) {
      return Promise.resolve(
        scenario.onClaim?.() ??
          jsonResponse({ assignees: [authenticatedAssignee] }),
      )
    }

    if (
      url === `/api/work-items/${workItemId}/comments` &&
      method === 'POST'
    ) {
      const submittedBody = readRequestBody(init)
      const parentCommentId =
        typeof submittedBody === 'object' &&
        submittedBody !== null &&
        'parentCommentId' in submittedBody &&
        typeof submittedBody.parentCommentId === 'string'
          ? submittedBody.parentCommentId
          : null
      const comment: CreatedWorkItemComment = {
        id: '30000000-0000-4000-8000-000000000001',
        body: 'Yeni test yorumu.',
        createdAt: '2026-09-14T10:00:00.000Z',
        author: {
          id: authenticatedUser.id,
          displayName: authenticatedUser.displayName,
          username: authenticatedUser.username,
        },
        parentCommentId,
      }
      return Promise.resolve(
        scenario.onComment?.(submittedBody) ??
          jsonResponse({ comment }, 201),
      )
    }

    const reactionMatch = url.match(
      new RegExp(`^/api/work-items/${workItemId}/comments/([^/]+)/reaction$`),
    )
    if (reactionMatch && (method === 'PUT' || method === 'DELETE')) {
      return Promise.resolve(
        scenario.onReaction?.(decodeURIComponent(reactionMatch[1]), method) ??
          jsonResponse({
            reactionCount: method === 'PUT' ? 1 : 0,
            reactedByCurrentUser: method === 'PUT',
          }),
      )
    }

    return Promise.resolve(jsonResponse({ message: 'Test isteği bulunamadı.' }, 500))
  })

  return {
    getDetailRequestCount: () => detailRequestCount,
    getOverviewRequestCount: () => overviewRequestCount,
  }
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function openCreateDialog(moduleTitle = 'Gelen Siparişler') {
  fireEvent.click(
    await screen.findByRole('button', {
      name: `${moduleTitle} modülüne iş ekle`,
    }),
  )

  return screen.findByRole('dialog', { name: 'Yeni İş Oluştur' })
}

async function openWorkItemPreview() {
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Deneme Ürünü işini görüntüle',
    }),
  )

  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByRole('heading', {
    name: 'Yorumlar ve Etkinlik',
  })

  return dialog
}

function makeEvent(overrides: Partial<WorkItemEvent>): WorkItemEvent {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    type: 'moved',
    createdAt: '2026-09-14T10:30:00.000Z',
    actor: {
      id: authenticatedUser.id,
      username: authenticatedUser.username,
      displayName: authenticatedUser.displayName,
    },
    fromModuleKey: 'incoming-orders',
    fromModuleTitle: 'Gelen Siparişler',
    toModuleKey: 'new-designs',
    toModuleTitle: 'Yeni Tasarımlar',
    ...overrides,
  }
}

function makeComment(
  id: string,
  overrides: Partial<WorkItemComment> = {},
): WorkItemComment {
  return {
    id,
    body: `Yorum ${id}`,
    createdAt: '2026-09-15T09:00:00.000Z',
    author: {
      id: secondUser.id,
      username: secondUser.username,
      displayName: secondUser.displayName,
    },
    reactionCount: 0,
    reactedByCurrentUser: false,
    replies: [],
    ...overrides,
  }
}

function fillRequiredCreateFields() {
  fireEvent.change(screen.getByLabelText('Firma İsmi'), {
    target: { value: '  Yeni Örnek Firma  ' },
  })
  fireEvent.change(screen.getByLabelText('Ürün'), {
    target: { value: '  Yeni Deneme Ürünü  ' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Phase 02A iş oluşturma akışı', () => {
  it('yedi modül başlığında çalışan artı butonlarını gösterir', async () => {
    installAuthenticatedApi()
    renderApp('/')

    await screen.findByRole('region', { name: 'BereCat modülleri' })

    for (const module of WORK_ITEM_MODULES) {
      expect(
        screen.getByRole('button', {
          name: `${module.title} modülüne iş ekle`,
        }),
      ).toBeInTheDocument()
    }
  })

  it('artı butonu formu doğru ve değiştirilemeyen modülle açar', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog('Dijital')
    const moduleInput = within(dialog).getByDisplayValue('Dijital')

    expect(moduleInput).toHaveAttribute('readonly')
  })

  it('formda beş grup ve tam Excel sütun alanlarını gösterir', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()

    for (const group of [
      'Temel Bilgiler',
      'Sipariş ve Miktar Bilgileri',
      'Tarihler',
      'Süreç ve Ürün Detayı',
      'Atama',
    ]) {
      expect(within(dialog).getByText(group)).toBeInTheDocument()
    }

    for (const label of [
      'Sipariş Kodu',
      'Firma İsmi',
      'Ürün',
      'Ambalaj Türü',
      'Tedarikçi Firma',
      'Sipariş Cinsi',
      'Stok',
      'İhtiyaç/Sipariş',
      'Verilen Sipariş Miktarı',
      'Gelen Sipariş Miktarı',
      'Sipariş Gelen Tarih',
      'Sipariş Verilen Tarih',
      'Sipariş Termin Tarihi',
      'Sipariş Sevk Tarihi',
      'Süreç Aşaması',
      'Ürün Detay',
    ]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument()
    }

    expect(within(dialog).getByText('Atanan Kişiler')).toBeInTheDocument()
  })

  it('iş formunda tarayıcının kayıtlı metin önerilerini kapatır', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()
    const orderCodeInput = within(dialog).getByLabelText('Sipariş Kodu')
    const companyInput = within(dialog).getByLabelText('Firma İsmi')

    expect(orderCodeInput.closest('form')).toHaveAttribute(
      'autocomplete',
      'off',
    )
    expect(orderCodeInput).toHaveAttribute('autocomplete', 'off')
    expect(companyInput).toHaveAttribute('autocomplete', 'off')
  })

  it('termini on iş günüyle doldurur ve elle değiştirilen tarihi korur', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()
    const placedDate = within(dialog).getByLabelText('Sipariş Verilen Tarih')
    const deadlineDate = within(dialog).getByLabelText('Sipariş Termin Tarihi')

    fireEvent.change(placedDate, { target: { value: '2026-09-04' } })
    expect(deadlineDate).toHaveValue('2026-09-18')

    fireEvent.change(deadlineDate, { target: { value: '2026-10-01' } })
    fireEvent.change(placedDate, { target: { value: '2026-09-07' } })
    expect(deadlineDate).toHaveValue('2026-10-01')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    const reopenedDialog = await openCreateDialog()
    fireEvent.change(
      within(reopenedDialog).getByLabelText('Sipariş Verilen Tarih'),
      { target: { value: '2026-09-07' } },
    )
    expect(
      within(reopenedDialog).getByLabelText('Sipariş Termin Tarihi'),
    ).toHaveValue('2026-09-21')
  })

  it('firma ve ürün boşken Türkçe zorunlu alan hatası gösterir', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Firma İsmi ve Ürün alanları zorunludur.',
    )
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) => input === '/api/work-items' && init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('iş formunda aktif kullanıcı seçeneklerini yükler', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Atanan Kişiler' }),
    )

    expect(
      await screen.findByRole('checkbox', { name: 'Deniz' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Selin' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/options',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('atama seçmeden iş oluşturur ve optional boşlukları null gönderir', async () => {
    let submittedBody: unknown
    installAuthenticatedApi({
      onCreate: (body) => {
        submittedBody = body
        return jsonResponse({ workItem: makeHomeItem() }, 201)
      },
    })
    renderApp('/')

    const dialog = await openCreateDialog()
    fillRequiredCreateFields()
    fireEvent.change(within(dialog).getByLabelText('Sipariş Kodu'), {
      target: { value: '   ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))

    await waitFor(() => {
      expect(submittedBody).toMatchObject({
        moduleKey: 'incoming-orders',
        companyName: 'Yeni Örnek Firma',
        productName: 'Yeni Deneme Ürünü',
        orderCode: null,
        assigneeIds: [],
      })
    })
  })

  it('seçilen kullanıcılarla atamalı iş oluşturur', async () => {
    let submittedBody: unknown
    installAuthenticatedApi({
      onCreate: (body) => {
        submittedBody = body
        return jsonResponse({ workItem: makeHomeItem() }, 201)
      },
    })
    renderApp('/')

    const dialog = await openCreateDialog()
    fillRequiredCreateFields()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Atanan Kişiler' }),
    )
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Selin' }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))

    await waitFor(() => {
      expect(submittedBody).toMatchObject({ assigneeIds: [secondUser.id] })
    })
  })

  it('başarılı oluşturma sonrasında modalı kapatır', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()
    fillRequiredCreateFields()
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Yeni İş Oluştur' }),
      ).not.toBeInTheDocument()
    })
  })

  it('oluşturma isteği beklerken Escape ve overlay modalı kapatmaz', async () => {
    const deferred = createDeferredResponse()
    installAuthenticatedApi({ onCreate: () => deferred.promise })
    renderApp('/')

    const dialog = await openCreateDialog()
    fillRequiredCreateFields()
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))

    expect(
      await within(dialog).findByRole('button', { name: 'Oluşturuluyor...' }),
    ).toBeDisabled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(dialog).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('create-work-item-dialog-overlay'))
    expect(dialog).toBeInTheDocument()

    deferred.resolve(jsonResponse({ workItem: makeHomeItem() }, 201))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Yeni İş Oluştur' }),
      ).not.toBeInTheDocument()
    })
  })

  it('oluşturma modalı kapanınca odağı ilgili artı butonuna döndürür', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const trigger = await screen.findByRole('button', {
      name: 'Gelen Siparişler modülüne iş ekle',
    })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', {
      name: 'Yeni İş Oluştur',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(trigger)
    })
  })

  it('başarılı oluşturma sonrasında boardu yenileyip yeni kartı üstte gösterir', async () => {
    const newestItem = makeHomeItem({
      id: '20000000-0000-4000-8000-000000000009',
      title: 'En Yeni Deneme Ürünü',
      assignees: [],
    })
    const api = installAuthenticatedApi({
      getOverview: (requestNumber) =>
        requestNumber === 1
          ? makeOverview([makeHomeItem()])
          : makeOverview([newestItem, makeHomeItem()]),
      onCreate: () => jsonResponse({ workItem: newestItem }, 201),
    })
    renderApp('/')

    const dialog = await openCreateDialog()
    fillRequiredCreateFields()
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))

    expect(
      await screen.findByRole('button', {
        name: 'En Yeni Deneme Ürünü işini görüntüle',
      }),
    ).toBeInTheDocument()
    expect(api.getOverviewRequestCount()).toBe(2)

    const incomingColumn = screen
      .getByRole('heading', { name: 'Gelen Siparişler' })
      .closest('section')
    const cards = within(incomingColumn as HTMLElement).getAllByRole('button', {
      name: /işini görüntüle$/,
    })
    expect(cards[0]).toHaveTextContent('En Yeni Deneme Ürünü')
  })

  it('API hatasında form değerlerini koruyup genel hata gösterir', async () => {
    installAuthenticatedApi({
      onCreate: () => jsonResponse({ message: 'Dahili ayrıntı' }, 500),
    })
    renderApp('/')

    const dialog = await openCreateDialog()
    fillRequiredCreateFields()
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'İş oluşturulamadı. Lütfen tekrar deneyin.',
    )
    expect(within(dialog).getByLabelText('Firma İsmi')).toHaveValue(
      '  Yeni Örnek Firma  ',
    )
    expect(within(dialog).queryByText('Dahili ayrıntı')).not.toBeInTheDocument()
  })
})

describe('Phase 02A iş detayı akışı', () => {
  it('kart önizlemesindeki Detaya Git ile tek genel detail rotasına gider', async () => {
    installAuthenticatedApi()
    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Deneme Ürünü işini görüntüle',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Detaya Git' }))

    expect(
      await screen.findByRole('heading', { name: 'İş Detayı' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Deneme Ürünü' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('detail sayfasında yedi ana bölümün tamamını gösterir', async () => {
    installAuthenticatedApi()
    renderApp(`/isler/${workItemId}`)

    await screen.findByRole('heading', { name: 'Deneme Ürünü' })

    for (const title of [
      'Temel Bilgiler',
      'Sipariş ve Miktar Bilgileri',
      'Tarihler',
      'Süreç ve Ürün Detayı',
      'Atanan Kişiler',
      'Yorumlar',
      'Kayıt Bilgileri',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('oluşturan kullanıcıyı ve kayıt tarihlerini gösterir', async () => {
    installAuthenticatedApi()
    renderApp(`/isler/${workItemId}`)

    await screen.findByRole('heading', { name: 'Kayıt Bilgileri' })
    const creatorLabel = screen.getByText('Oluşturan')
    const creatorField = creatorLabel.closest('div')

    expect(creatorField).not.toBeNull()
    expect(within(creatorField as HTMLElement).getByText('Deniz')).toBeInTheDocument()
    expect(screen.getByText('Oluşturulma Tarihi')).toBeInTheDocument()
    expect(screen.getByText('Son Güncelleme')).toBeInTheDocument()
  })

  it('atama listesini aktif kullanıcı seçenekleriyle değiştirir', async () => {
    let currentDetail = makeDetail()
    let submittedBody: unknown
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onAssign: (body) => {
        submittedBody = body
        currentDetail = {
          ...currentDetail,
          assignees: [secondAssignee],
          updatedAt: '2026-09-14T11:00:00.000Z',
        }
        return jsonResponse({ assignees: [secondAssignee] })
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Atanan Kişiler' }),
    )
    const denizCheckbox = await screen.findByRole('checkbox', { name: 'Deniz' })
    const selinCheckbox = screen.getByRole('checkbox', { name: 'Selin' })
    fireEvent.click(denizCheckbox)
    fireEvent.click(selinCheckbox)
    fireEvent.click(screen.getByRole('button', { name: 'Atamayı Kaydet' }))

    await waitFor(() => {
      expect(submittedBody).toEqual({ userIds: [secondUser.id] })
    })
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atanan Kişiler' }),
      ).toHaveTextContent('Selin')
    })
  })

  it('atanmamış Gelen Siparişler işinde üzerine alma butonunu gösterir', async () => {
    installAuthenticatedApi({
      getDetail: () => makeDetail({ assignees: [] }),
    })
    renderApp(`/isler/${workItemId}`)

    expect(
      await screen.findByRole('button', { name: 'Görevi Üzerime Al' }),
    ).toBeInTheDocument()
  })

  it('claim sonrasında mevcut kullanıcıyı atanmış gösterip butonu kaldırır', async () => {
    let currentDetail = makeDetail({ assignees: [] })
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onClaim: () => {
        currentDetail = {
          ...currentDetail,
          assignees: [authenticatedAssignee],
          updatedAt: '2026-09-14T11:30:00.000Z',
        }
        return jsonResponse({ assignees: [authenticatedAssignee] })
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Görevi Üzerime Al' }),
    )

    expect(
      await screen.findByRole('button', { name: 'Atanan Kişiler' }),
    ).toHaveTextContent('Deniz')
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Görevi Üzerime Al' }),
      ).not.toBeInTheDocument()
    })
  })

  it('claim yarışında güvenli 409 mesajını gösterip detayı yeniler', async () => {
    let currentDetail = makeDetail({ assignees: [] })
    let detailRequestCount = 0
    installAuthenticatedApi({
      getDetail: () => {
        detailRequestCount += 1
        return currentDetail
      },
      onClaim: () => {
        currentDetail = { ...currentDetail, assignees: [secondAssignee] }
        return jsonResponse(
          { message: 'Bu iş başka bir kullanıcı tarafından alınmış.' },
          409,
        )
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Görevi Üzerime Al' }),
    )

    await waitFor(() => expect(detailRequestCount).toBe(2))
    expect(
      screen.getByText('Bu iş başka bir kullanıcı tarafından alınmış.'),
    ).toBeInTheDocument()
  })

  it('yorum ekleyip textarea alanını temizler ve yeni yorumu gösterir', async () => {
    const newComment: WorkItemComment = {
      id: '30000000-0000-4000-8000-000000000002',
      body: 'Yeni test yorumu.',
      createdAt: '2026-09-14T12:00:00.000Z',
      author: {
        id: authenticatedUser.id,
        displayName: authenticatedUser.displayName,
        username: authenticatedUser.username,
      },
      reactionCount: 0,
      reactedByCurrentUser: false,
      replies: [],
    }
    let currentDetail = makeDetail()
    let submittedBody: unknown
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onComment: (body) => {
        submittedBody = body
        currentDetail = {
          ...currentDetail,
          comments: [...currentDetail.comments, newComment],
        }
        return jsonResponse(
          { comment: { ...newComment, parentCommentId: null } },
          201,
        )
      },
    })
    renderApp(`/isler/${workItemId}`)

    const textarea = await screen.findByLabelText('Yeni Yorum')
    fireEvent.change(textarea, { target: { value: '  Yeni test yorumu.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Yorum Ekle' }))

    await waitFor(() => {
      expect(submittedBody).toEqual({
        body: 'Yeni test yorumu.',
        parentCommentId: null,
      })
    })
    expect(await screen.findByText('Yeni test yorumu.')).toBeInTheDocument()
    expect(textarea).toHaveValue('')
  })

  it('yalnız ana yorumda Yanıtla gösterir, reply modunu açar ve iptal eder', async () => {
    const rootComment: WorkItemComment = {
      id: '30000000-0000-4000-8000-000000000020',
      body: 'Ana yorum metni.',
      createdAt: '2026-09-14T11:00:00.000Z',
      author: {
        id: secondUser.id,
        username: secondUser.username,
        displayName: 'Eren',
      },
      reactionCount: 0,
      reactedByCurrentUser: false,
      replies: [
        {
          id: '30000000-0000-4000-8000-000000000021',
          body: 'Mevcut yanıt metni.',
          createdAt: '2026-09-14T11:15:00.000Z',
          author: makeDetail().createdBy,
          reactionCount: 0,
          reactedByCurrentUser: false,
        },
      ],
    }
    installAuthenticatedApi({
      getDetail: () => makeDetail({ comments: [rootComment] }),
    })
    renderApp('/')

    const dialog = await openWorkItemPreview()
    expect(
      await within(dialog).findByText('Mevcut yanıt metni.'),
    ).toBeInTheDocument()
    const replyButtons = within(dialog).getAllByRole('button', {
      name: 'Yanıtla',
    })
    expect(replyButtons).toHaveLength(1)
    fireEvent.click(replyButtons[0])

    const replyTextarea = within(dialog).getByLabelText('Yanıtınız')
    expect(
      within(dialog).getByText(
        'Eren adlı kullanıcının yorumuna yanıt veriyorsunuz.',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Yanıt Ekle' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(replyTextarea).toHaveFocus())

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Yanıtı İptal Et' }),
    )

    expect(within(dialog).getByLabelText('Yeni Yorum')).toBeInTheDocument()
    expect(
      within(dialog).queryByText(
        'Eren adlı kullanıcının yorumuna yanıt veriyorsunuz.',
      ),
    ).not.toBeInTheDocument()
  })

  it('ana yoruma yanıt gönderir, alanı temizler ve yanıtı altında gösterir', async () => {
    const rootComment: WorkItemComment = {
      id: '30000000-0000-4000-8000-000000000022',
      body: 'Yanıt beklenecek ana yorum.',
      createdAt: '2026-09-14T11:00:00.000Z',
      author: {
        id: secondUser.id,
        username: secondUser.username,
        displayName: 'Eren',
      },
      reactionCount: 0,
      reactedByCurrentUser: false,
      replies: [],
    }
    const newReply = {
      id: '30000000-0000-4000-8000-000000000023',
      body: 'Yeni alt yanıt.',
      createdAt: '2026-09-14T11:30:00.000Z',
      author: makeDetail().createdBy,
      reactionCount: 0,
      reactedByCurrentUser: false,
    }
    let currentDetail = makeDetail({ comments: [rootComment] })
    let submittedBody: unknown
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onComment: (body) => {
        submittedBody = body
        currentDetail = {
          ...currentDetail,
          comments: [{ ...rootComment, replies: [newReply] }],
        }
        return jsonResponse(
          {
            comment: {
              ...newReply,
              parentCommentId: rootComment.id,
            },
          },
          201,
        )
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(await screen.findByRole('button', { name: 'Yanıtla' }))
    const textarea = screen.getByLabelText('Yanıtınız')
    fireEvent.change(textarea, { target: { value: '  Yeni alt yanıt.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Yanıt Ekle' }))

    await waitFor(() => {
      expect(submittedBody).toEqual({
        body: 'Yeni alt yanıt.',
        parentCommentId: rootComment.id,
      })
    })
    expect(await screen.findByText('Yeni alt yanıt.')).toBeInTheDocument()
    expect(screen.getByLabelText('Yeni Yorum')).toHaveValue('')
    expect(screen.getAllByRole('button', { name: 'Yanıtla' })).toHaveLength(1)
  })

  it('boş veya yalnız boşluk içeren yorumun gönderilmesine izin vermez', async () => {
    installAuthenticatedApi()
    renderApp(`/isler/${workItemId}`)

    const textarea = await screen.findByLabelText('Yeni Yorum')
    fireEvent.change(textarea, { target: { value: '   ' } })
    const submitButton = screen.getByRole('button', { name: 'Yorum Ekle' })

    expect(submitButton).toBeDisabled()
    fireEvent.click(submitButton)
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          input === `/api/work-items/${workItemId}/comments` &&
          init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('yorum bulunmadığında empty state gösterir', async () => {
    installAuthenticatedApi({ getDetail: () => makeDetail({ comments: [] }) })
    renderApp(`/isler/${workItemId}`)

    expect(await screen.findByText('Henüz yorum yok.')).toBeInTheDocument()
  })

  it('detail 404 durumunda güvenli mesaj ve anasayfa bağlantısı gösterir', async () => {
    installAuthenticatedApi({ detailStatus: 404 })
    renderApp(`/isler/${workItemId}`)

    expect(await screen.findByText('İş bulunamadı.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Anasayfaya Dön' }),
    ).toHaveAttribute('href', '/')
  })

  it('detail sayfasından dönüşte boardu yeniden yükleyip güncel atamayı gösterir', async () => {
    const api = installAuthenticatedApi({
      getDetail: () => makeDetail({ assignees: [] }),
      getOverview: () =>
        makeOverview([
          makeHomeItem({
            assignees: [
              { id: secondUser.id, displayName: secondUser.displayName },
            ],
          }),
        ]),
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('link', { name: 'Anasayfaya Dön' }),
    )

    expect(
      await screen.findByRole('region', { name: 'BereCat modülleri' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Selin')).toBeInTheDocument()
    expect(api.getOverviewRequestCount()).toBe(1)
  })

  it('detail 401 durumunda mevcut auth akışıyla login ekranına döner', async () => {
    installAuthenticatedApi({ detailStatus: 401 })
    renderApp(`/isler/${workItemId}`)

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
  })
})

describe('Phase 02B iş akışı ve aktivite deneyimi', () => {
  it('headerda aktif kullanıcının avatarını ve görünen adını gösterir', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const header = await screen.findByRole('banner')
    expect(within(header).getByText('D')).toBeInTheDocument()
    expect(within(header).getByText('Deniz')).toBeInTheDocument()
    expect(
      within(header).getByRole('link', {
        name: 'BereCat anasayfasına git',
      }),
    ).toHaveAttribute('href', '/')
  })

  it('header profilinde takım ve kullanıcı adı ayrıntılarını göstermez', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const header = await screen.findByRole('banner')
    expect(within(header).queryByText('Grafik')).not.toBeInTheDocument()
    expect(within(header).queryByText('@deniz')).not.toBeInTheDocument()
    expect(
      within(header).getByRole('button', { name: 'Çıkış yap' }),
    ).toBeInTheDocument()
  })

  it('kart tıklanınca güncel detail endpointini credentials ile çağırır', async () => {
    installAuthenticatedApi()
    renderApp('/')

    await openWorkItemPreview()

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/work-items/${workItemId}`,
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })

  it('popupta Yorumlar ve Etkinlik bölümünü gösterir', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()

    expect(
      within(dialog).getByRole('heading', { name: 'Yorumlar ve Etkinlik' }),
    ).toBeInTheDocument()
  })

  it('popup içinde genişletilmiş iş bilgilerini gösterir', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()

    for (const label of [
      'Firma İsmi',
      'Ürün',
      'Ambalaj Türü',
      'Sipariş Cinsi',
      'Verilen Sipariş Miktarı',
      'Gelen Sipariş Miktarı',
      'Ürün Detay',
      'Durum',
      'Sipariş Gelen Tarih',
      'Sipariş Verilen Tarih',
      'Sipariş Termin Tarihi',
      'Sipariş Sevk Tarihi',
      'Atanan Kişiler',
    ]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument()
    }

    expect(within(dialog).getByText('Devam Ediyor')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Test kapsamındaki ürün detayı.'),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText('Süreç Kodu')).not.toBeInTheDocument()
  })

  it('popup içinden trimlenmiş yorum ekler ve güncel aktivitede gösterir', async () => {
    const newComment: WorkItemComment = {
      id: '30000000-0000-4000-8000-000000000010',
      body: 'Popup üzerinden eklenen yorum.',
      createdAt: '2026-09-14T12:30:00.000Z',
      author: {
        id: authenticatedUser.id,
        username: authenticatedUser.username,
        displayName: authenticatedUser.displayName,
      },
      reactionCount: 0,
      reactedByCurrentUser: false,
      replies: [],
    }
    let currentDetail = makeDetail()
    let submittedBody: unknown
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onComment: (body) => {
        submittedBody = body
        currentDetail = {
          ...currentDetail,
          comments: [...currentDetail.comments, newComment],
        }
        return jsonResponse(
          { comment: { ...newComment, parentCommentId: null } },
          201,
        )
      },
    })
    renderApp('/')

    const dialog = await openWorkItemPreview()
    const textarea = within(dialog).getByLabelText('Yeni Yorum')
    fireEvent.change(textarea, {
      target: { value: '  Popup üzerinden eklenen yorum.  ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yorum Ekle' }))

    await waitFor(() => {
      expect(submittedBody).toEqual({
        body: 'Popup üzerinden eklenen yorum.',
        parentCommentId: null,
      })
    })
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/work-items/${workItemId}/comments`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
    expect(
      await within(dialog).findByText('Popup üzerinden eklenen yorum.'),
    ).toBeInTheDocument()
  })

  it('başarılı popup yorumundan sonra textarea alanını temizler', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()
    const textarea = within(dialog).getByLabelText('Yeni Yorum')
    fireEvent.change(textarea, { target: { value: 'Yeni test yorumu.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yorum Ekle' }))

    await waitFor(() => expect(textarea).toHaveValue(''))
  })

  it('dış boşlukları attıktan sonra 2000 emoji karakterlik yorumu kabul eder', async () => {
    const commentBody = '😀'.repeat(2000)
    let submittedBody: unknown
    installAuthenticatedApi({
      onComment: (body) => {
        submittedBody = body
        return jsonResponse(
          {
            comment: {
              id: '30000000-0000-4000-8000-000000000012',
              body: commentBody,
              createdAt: '2026-09-14T12:45:00.000Z',
              author: makeDetail().createdBy,
              parentCommentId: null,
            },
          },
          201,
        )
      },
    })
    renderApp('/')

    const dialog = await openWorkItemPreview()
    const textarea = within(dialog).getByLabelText('Yeni Yorum')
    fireEvent.change(textarea, { target: { value: `  ${commentBody}  ` } })
    const submitButton = within(dialog).getByRole('button', {
      name: 'Yorum Ekle',
    })

    expect(submitButton).not.toBeDisabled()
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(submittedBody).toEqual({ body: commentBody, parentCommentId: null })
    })
    expect(Array.from(commentBody)).toHaveLength(2000)
  })

  it('trim sonrası 2000 karakteri aşan yorumu local olarak reddeder', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()
    fireEvent.change(within(dialog).getByLabelText('Yeni Yorum'), {
      target: { value: `  ${'😀'.repeat(2001)}  ` },
    })

    expect(
      within(dialog).getByText('Yorum 1 ile 2000 karakter arasında olmalıdır.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Yorum Ekle' }),
    ).toBeDisabled()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          input === `/api/work-items/${workItemId}/comments` &&
          init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('iş oluşturulma aktivitesini Türkçe gösterir', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()

    expect(within(dialog).getByText('Deniz bu işi oluşturdu.')).toBeInTheDocument()
  })

  it('move aktivitesini birim adlarıyla Türkçe gösterir', async () => {
    installAuthenticatedApi({
      getDetail: () => makeDetail({ events: [makeEvent({})] }),
    })
    renderApp('/')

    const dialog = await openWorkItemPreview()

    expect(
      within(dialog).getByText(
        'Deniz işi “Gelen Siparişler” biriminden “Yeni Tasarımlar” birimine aktardı.',
      ),
    ).toBeInTheDocument()
  })

  it('completed aktivitesini Türkçe gösterir', async () => {
    installAuthenticatedApi({
      getDetail: () =>
        makeDetail({
          events: [
            makeEvent({
              type: 'completed',
              fromModuleKey: null,
              fromModuleTitle: null,
              toModuleKey: null,
              toModuleTitle: null,
            }),
          ],
        }),
    })
    renderApp('/')

    const dialog = await openWorkItemPreview()
    expect(within(dialog).getByText('Deniz işi tamamladı.')).toBeInTheDocument()
  })

  it('reopened aktivitesini Türkçe gösterir', async () => {
    installAuthenticatedApi({
      getDetail: () =>
        makeDetail({
          events: [
            makeEvent({
              type: 'reopened',
              fromModuleKey: null,
              fromModuleTitle: null,
              toModuleKey: null,
              toModuleTitle: null,
            }),
          ],
        }),
    })
    renderApp('/')

    const dialog = await openWorkItemPreview()
    expect(within(dialog).getByText('Deniz işi yeniden açtı.')).toBeInTheDocument()
  })

  it('yorumları sistem etkinliklerinden ayrı listelerde gösterir', async () => {
    const comment: WorkItemComment = {
      id: '30000000-0000-4000-8000-000000000011',
      body: 'Sıralama için test yorumu.',
      createdAt: '2026-09-14T09:00:00.000Z',
      author: {
        id: authenticatedUser.id,
        username: authenticatedUser.username,
        displayName: authenticatedUser.displayName,
      },
      reactionCount: 0,
      reactedByCurrentUser: false,
      replies: [],
    }
    const movedEvent = makeEvent({
      createdAt: '2026-09-14T10:30:00.000Z',
    })
    installAuthenticatedApi({
      getDetail: () =>
        makeDetail({ comments: [comment], events: [movedEvent] }),
    })
    renderApp('/')

    const dialog = await openWorkItemPreview()
    const activityList = within(dialog).getByRole('list', {
      name: 'İş aktivite geçmişi',
    })
    const activities = within(activityList).getAllByRole('listitem')
    const commentList = within(dialog).getByRole('list', {
      name: 'İş yorumları',
    })
    const comments = within(commentList).getAllByRole('listitem')

    expect(activities).toHaveLength(2)
    expect(comments).toHaveLength(1)
    expect(activities[0]).toHaveTextContent(
      'Deniz işi “Gelen Siparişler” biriminden “Yeni Tasarımlar” birimine aktardı.',
    )
    expect(comments[0]).toHaveTextContent('Sıralama için test yorumu.')
    expect(activities[1]).toHaveTextContent('Deniz bu işi oluşturdu.')
    expect(activities[0].querySelector('time')).toHaveAttribute(
      'datetime',
      movedEvent.createdAt,
    )
    expect(comments[0].querySelector('time')).toHaveAttribute(
      'datetime',
      comment.createdAt,
    )
    expect(activities[1].querySelector('time')).toHaveAttribute(
      'datetime',
      makeDetail().createdAt,
    )
  })

  it('active kartı draggable ve yedi modülü droppable yapar', async () => {
    installAuthenticatedApi()
    renderApp('/')

    expect(await screen.findByTestId(`work-item-card-${workItemId}`)).toHaveAttribute(
      'data-draggable',
      'true',
    )
    for (const module of WORK_ITEM_MODULES) {
      expect(screen.getByTestId(`work-item-module-${module.key}`)).toHaveAttribute(
        'data-droppable',
        'true',
      )
    }
  })

  it('popup içinde eski birim aktarma kontrollerini göstermez', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()

    expect(within(dialog).queryByLabelText('Hedef Birim')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Aktar' })).not.toBeInTheDocument()
  })

  it('detay sayfasında eski birim aktarma kontrollerini göstermez', async () => {
    installAuthenticatedApi()
    renderApp(`/isler/${workItemId}`)

    await screen.findByText('Devam Ediyor')
    expect(screen.queryByLabelText('Hedef Birim')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aktar' })).not.toBeInTheDocument()
  })

  it('kart ikonuyla onaysız tamamlar ve popup açmaz', async () => {
    installAuthenticatedApi()
    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', { name: 'İşi tamamla' }),
    )

    await waitFor(() => {
      const completeCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          input === `/api/work-items/${workItemId}/complete` &&
          init?.method === 'POST',
      )
      expect(completeCall).toBeDefined()
      expect(completeCall?.[1]?.body).toBeUndefined()
      expect(completeCall?.[1]?.credentials).toBe('include')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('tamamlama sonrası kartı hemen boarddan kaldırır ve boardu yeniler', async () => {
    const api = installAuthenticatedApi({
      getOverview: (requestNumber) =>
        requestNumber === 1 ? makeOverview() : makeOverview([]),
    })
    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', { name: 'İşi tamamla' }),
    )

    expect(
      screen.queryByRole('button', { name: 'Deneme Ürünü işini görüntüle' }),
    ).not.toBeInTheDocument()
    await waitFor(() => expect(api.getOverviewRequestCount()).toBe(2))
  })

  it('kartı güncel detayla çoğaltır ve yeni kaydı Gelen Siparişler üstünde gösterir', async () => {
    const sourceItem = makeHomeItem({ title: 'Kaynak Ürün' })
    const duplicatedItem = makeHomeItem({
      id: '20000000-0000-4000-8000-000000000030',
      title: 'Çoğaltılan Ürün',
      assignees: [],
    })
    const sourceComment: WorkItemComment = {
      id: '30000000-0000-4000-8000-000000000030',
      body: 'Forma taşınmaması gereken yorum.',
      createdAt: '2026-09-14T10:00:00.000Z',
      author: makeDetail().createdBy,
      reactionCount: 0,
      reactedByCurrentUser: false,
      replies: [],
    }
    const sourceDetail = makeDetail({
      moduleKey: 'pricing',
      moduleTitle: 'Fiyatlandırma',
      productName: 'Kaynak Ürün',
      comments: [sourceComment],
      events: [makeEvent({})],
    })
    let submittedBody: unknown
    const api = installAuthenticatedApi({
      getOverview: (requestNumber) =>
        requestNumber === 1
          ? makeOverviewForModule('pricing', [sourceItem])
          : {
              modules: WORK_ITEM_MODULES.map((module) => ({
                id: module.key,
                title: module.title,
                items:
                  module.key === 'incoming-orders'
                    ? [duplicatedItem]
                    : module.key === 'pricing'
                      ? [sourceItem]
                      : [],
              })),
            },
      getDetail: () => sourceDetail,
      onCreate: (body) => {
        submittedBody = body
        return jsonResponse({ workItem: duplicatedItem }, 201)
      },
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi çoğalt' }))

    const dialog = await screen.findByRole('dialog', { name: 'İşi Çoğalt' })
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Firma İsmi')).toHaveValue(
        sourceDetail.companyName,
      )
      expect(within(dialog).getByLabelText('Ürün')).toHaveValue('Kaynak Ürün')
    })
    expect(within(dialog).getByDisplayValue('Gelen Siparişler')).toHaveAttribute(
      'readonly',
    )
    expect(within(dialog).getByLabelText('Sipariş Verilen Tarih')).toHaveValue(
      sourceDetail.orderPlacedDate,
    )
    expect(within(dialog).getByLabelText('Sipariş Termin Tarihi')).toHaveValue(
      sourceDetail.orderDeadlineDate,
    )
    expect(within(dialog).queryByText(sourceComment.body)).not.toBeInTheDocument()
    expect(api.getDetailRequestCount()).toBe(1)
    expect(screen.queryByRole('dialog', { name: 'İş Önizlemesi' })).not.toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Atanan Kişiler' }),
    )
    const selectedAssignee = await screen.findByRole('checkbox', {
      name: 'Deniz',
    })
    expect((selectedAssignee as HTMLInputElement).checked).toBe(true)

    fireEvent.change(within(dialog).getByLabelText('Ürün'), {
      target: { value: 'Çoğaltılan Ürün' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Kopyayı Oluştur' }),
    )

    await waitFor(() => {
      expect(submittedBody).toMatchObject({
        moduleKey: 'incoming-orders',
        orderCode: sourceDetail.orderCode,
        companyName: sourceDetail.companyName,
        productName: 'Çoğaltılan Ürün',
        packagingType: sourceDetail.packagingType,
        supplierCompany: sourceDetail.supplierCompany,
        orderType: sourceDetail.orderType,
        stockValue: sourceDetail.stockValue,
        needOrderValue: sourceDetail.needOrderValue,
        orderedQuantity: sourceDetail.orderedQuantity,
        receivedQuantity: sourceDetail.receivedQuantity,
        orderReceivedDate: sourceDetail.orderReceivedDate,
        orderPlacedDate: sourceDetail.orderPlacedDate,
        orderDeadlineDate: sourceDetail.orderDeadlineDate,
        orderShipmentDate: sourceDetail.orderShipmentDate,
        processStage: sourceDetail.processStage,
        productDetail: sourceDetail.productDetail,
        assigneeIds: [authenticatedUser.id],
      })
    })
    expect(submittedBody).not.toHaveProperty('id')
    expect(submittedBody).not.toHaveProperty('status')
    expect(submittedBody).not.toHaveProperty('comments')
    expect(submittedBody).not.toHaveProperty('events')
    expect(
      await screen.findByRole('button', {
        name: 'Çoğaltılan Ürün işini görüntüle',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Kaynak Ürün işini görüntüle' }),
    ).toBeInTheDocument()
    expect(api.getOverviewRequestCount()).toBe(2)
  })

  it('çoğaltma detayı yüklenemezse güvenli hata gösterir', async () => {
    installAuthenticatedApi({ detailStatus: 500 })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi çoğalt' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'İş bilgileri yüklenemedi.',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('completed işte aktarma ve tamamlama kontrollerini göstermez', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()

    expect(within(dialog).queryByLabelText('Hedef Birim')).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', {
        name: 'Tamamlandı Olarak İşaretle',
      }),
    ).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'İşi yeniden aç' })).not.toBeInTheDocument()
  })

  it('completed iş detayında atama kaydetme ve claim butonlarını göstermez', async () => {
    installAuthenticatedApi({
      getDetail: () =>
        makeDetail({
          status: 'completed',
          completedAt: '2026-09-14T13:00:00.000Z',
          completedBy: makeDetail().createdBy,
        }),
    })
    renderApp(`/isler/${workItemId}`)

    await screen.findByRole('heading', { name: 'Atanan Kişiler' })
    expect(
      screen.queryByRole('button', { name: 'Atamayı Kaydet' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Görevi Üzerime Al' }),
    ).not.toBeInTheDocument()
  })

  it('completed kayıt yanlışlıkla home payloadında gelse bile boardda göstermez', async () => {
    installAuthenticatedApi({
      getOverview: () =>
        makeOverview([
          makeHomeItem({
            status: 'completed',
            completedAt: '2026-09-14T13:00:00.000Z',
          }),
        ]),
    })
    renderApp('/')

    await screen.findByRole('region', { name: 'BereCat modülleri' })
    expect(
      screen.queryByRole('button', {
        name: 'Deneme Ürünü işini görüntüle',
      }),
    ).not.toBeInTheDocument()
  })

  it('active kartı gösterip completed kartı boarddan çıkarır', async () => {
    const completed = makeHomeItem({
      id: '20000000-0000-4000-8000-000000000020',
      title: 'Tamamlanan İş',
      status: 'completed',
      completedAt: '2026-09-14T13:00:00.000Z',
    })
    const active = makeHomeItem({
      id: '20000000-0000-4000-8000-000000000021',
      title: 'Devam Eden İş',
    })
    installAuthenticatedApi({ getOverview: () => makeOverview([completed, active]) })
    renderApp('/')

    const column = (await screen.findByRole('heading', {
      name: 'Gelen Siparişler',
    })).closest('section')
    const cards = within(column as HTMLElement).getAllByRole('button', {
      name: /işini görüntüle$/,
    })

    expect(cards[0]).toHaveTextContent('Devam Eden İş')
    expect(cards).toHaveLength(1)
    expect(
      within(column as HTMLElement).queryByText('Tamamlanan İş'),
    ).not.toBeInTheDocument()
  })

  it('completed işi yeniden açma endpointiyle günceller', async () => {
    let reopened = false
    installAuthenticatedApi({
      getDetail: () =>
        makeDetail({
          status: 'completed',
          completedAt: '2026-09-14T13:00:00.000Z',
          completedBy: makeDetail().createdBy,
        }),
      onReopen: () => {
        reopened = true
        return jsonResponse({ workItem: makeHomeItem() })
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('button', { name: 'İşi Yeniden Aç' }),
    )

    await waitFor(() => expect(reopened).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/work-items/${workItemId}/reopen`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('reopen sonrasında active durumu ve etkinliği getirir, eski aksiyonları göstermez', async () => {
    let currentDetail = makeDetail({
      status: 'completed',
      completedAt: '2026-09-14T13:00:00.000Z',
      completedBy: makeDetail().createdBy,
    })
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onReopen: () => {
        currentDetail = {
          ...currentDetail,
          status: 'active',
          completedAt: null,
          completedBy: null,
          events: [
            makeEvent({
              type: 'reopened',
              fromModuleKey: null,
              fromModuleTitle: null,
              toModuleKey: null,
              toModuleTitle: null,
            }),
          ],
        }
        return jsonResponse({ workItem: makeHomeItem() })
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('button', { name: 'İşi Yeniden Aç' }),
    )

    expect(await screen.findByText('Devam Ediyor')).toBeInTheDocument()
    expect(screen.queryByLabelText('Hedef Birim')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Tamamlandı Olarak İşaretle',
      }),
    ).not.toBeInTheDocument()
    const statusField = screen.getByText('Durum').closest('div')
    expect(statusField).not.toBeNull()
    expect(
      within(statusField as HTMLElement).getByText('Devam Ediyor'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Tamamlayan')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Tamamlanma Tarihi'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Deniz işi yeniden açtı.')).toBeInTheDocument()
  })

  it('detail reopen sonrasında completion alanlarını kaldırıp atama kontrollerini açar', async () => {
    let currentDetail = makeDetail({
      status: 'completed',
      completedAt: '2026-09-14T13:00:00.000Z',
      completedBy: makeDetail().createdBy,
    })
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onReopen: () => {
        currentDetail = {
          ...currentDetail,
          status: 'active',
          completedAt: null,
          completedBy: null,
        }
        return jsonResponse({ workItem: makeHomeItem() })
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('button', { name: 'İşi Yeniden Aç' }),
    )

    expect(await screen.findByText('Devam Ediyor')).toBeInTheDocument()
    expect(screen.queryByText('Tamamlayan')).not.toBeInTheDocument()
    expect(screen.queryByText('Tamamlanma Tarihi')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Hedef Birim')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atamayı Kaydet' }),
      ).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atanan Kişiler' }))
    expect(screen.getByRole('checkbox', { name: 'Deniz' })).toBeInTheDocument()
  })

  it('detail sayfasında active status bilgisini gösterir', async () => {
    installAuthenticatedApi()
    renderApp(`/isler/${workItemId}`)

    expect(await screen.findByText('Devam Ediyor')).toBeInTheDocument()
  })

  it('detail sayfasında completed status ve tamamlayan kullanıcıyı gösterir', async () => {
    const creator = makeDetail().createdBy
    installAuthenticatedApi({
      getDetail: () =>
        makeDetail({
          status: 'completed',
          completedAt: '2026-09-14T13:00:00.000Z',
          completedBy: creator,
        }),
    })
    renderApp(`/isler/${workItemId}`)

    expect(await screen.findByText('Tamamlandı')).toBeInTheDocument()
    const completedByLabel = screen.getByText('Tamamlayan')
    const completedByField = completedByLabel.closest('div')
    expect(completedByField).not.toBeNull()
    expect(
      within(completedByField as HTMLElement).getByText('Deniz'),
    ).toBeInTheDocument()
    expect(screen.getByText('Tamamlanma Tarihi')).toBeInTheDocument()
  })

  it('kart tamamlama isteği beklerken ikinci mutationı engeller', async () => {
    const deferred = createDeferredResponse()
    let completeRequestCount = 0
    installAuthenticatedApi({
      onComplete: () => {
        completeRequestCount += 1
        return deferred.promise
      },
    })
    renderApp('/')

    const completeButton = await screen.findByRole('button', {
      name: 'İşi tamamla',
    })
    fireEvent.click(completeButton)
    fireEvent.click(completeButton)

    await waitFor(() => expect(completeRequestCount).toBe(1))
    expect(
      screen.queryByRole('button', { name: 'Deneme Ürünü işini görüntüle' }),
    ).not.toBeInTheDocument()
    expect(completeRequestCount).toBe(1)

    deferred.resolve(
      jsonResponse({ workItem: makeHomeItem({ status: 'completed' }) }),
    )
    await waitFor(() => expect(completeRequestCount).toBe(1))
  })

  it('reopen sonrası yavaş detail refetch bitene kadar ikinci mutationı engeller', async () => {
    const deferred = createDeferredResponse()
    const completedDetail = makeDetail({
      status: 'completed',
      completedAt: '2026-09-14T13:00:00.000Z',
      completedBy: makeDetail().createdBy,
    })
    let reopenRequestCount = 0
    installAuthenticatedApi({
      getDetailResponse: (requestNumber) =>
        requestNumber === 1
          ? jsonResponse({ workItem: completedDetail })
          : deferred.promise,
      onReopen: () => {
        reopenRequestCount += 1
        return jsonResponse({ workItem: makeHomeItem() })
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(
      await screen.findByRole('button', { name: 'İşi Yeniden Aç' }),
    )

    await waitFor(() => expect(reopenRequestCount).toBe(1))
    const waitingButton = await screen.findByRole('button', {
      name: 'Yeniden açılıyor…',
    })
    expect(waitingButton).toBeDisabled()
    fireEvent.click(waitingButton)
    expect(reopenRequestCount).toBe(1)

    deferred.resolve(
      jsonResponse({
        workItem: makeDetail({
          status: 'active',
          completedAt: null,
          completedBy: null,
        }),
      }),
    )

    expect(await screen.findByText('Devam Ediyor')).toBeInTheDocument()
    expect(screen.queryByLabelText('Hedef Birim')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Atanan Kişiler' }),
      ).not.toBeDisabled(),
    )
  })

  it('detail sayfasında move ve complete aksiyonlarını göstermez', async () => {
    installAuthenticatedApi()
    renderApp(`/isler/${workItemId}`)

    await screen.findByText('Devam Ediyor')
    expect(screen.queryByLabelText('Hedef Birim')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aktar' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Tamamlandı Olarak İşaretle',
      }),
    ).not.toBeInTheDocument()
  })

  it('popup Detaya Git ile genel iş detayı rotasına gider', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openWorkItemPreview()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Detaya Git' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'İş Detayı' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('popup detail hatasında güvenli birebir mesaj gösterip tekrar dener', async () => {
    const api = installAuthenticatedApi({
      getDetailResponse: (requestNumber) =>
        requestNumber === 1
          ? jsonResponse({ message: 'Dahili ayrıntı' }, 500)
          : jsonResponse({ workItem: makeDetail() }),
    })
    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Deneme Ürünü işini görüntüle',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText('İş detayları yüklenemedi.'),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText('Dahili ayrıntı')).not.toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tekrar Dene' }),
    )

    expect(
      await within(dialog).findByRole('heading', {
        name: 'Yorumlar ve Etkinlik',
      }),
    ).toBeInTheDocument()
    expect(api.getDetailRequestCount()).toBe(2)
  })

  it('popup detail beklenirken loading durumunu gösterir', async () => {
    const deferred = createDeferredResponse()
    installAuthenticatedApi({ getDetailResponse: () => deferred.promise })
    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Deneme Ürünü işini görüntüle',
      }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('İş detayları yükleniyor…'),
    ).toBeInTheDocument()

    deferred.resolve(jsonResponse({ workItem: makeDetail() }))
    expect(
      await within(dialog).findByRole('heading', {
        name: 'Yorumlar ve Etkinlik',
      }),
    ).toBeInTheDocument()
  })

  it('popup detail 401 durumunda mevcut auth akışıyla login ekranına döner', async () => {
    installAuthenticatedApi({ detailStatus: 401 })
    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Deneme Ürünü işini görüntüle',
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
  })
})

describe('Phase 02D iş düzenleme ve güvenli silme arayüzü', () => {
  it('active kartta dört kompakt aksiyonu gösterir ve düzenleme yüklenirken popup açmaz', async () => {
    const deferred = createDeferredResponse()
    installAuthenticatedApi({ getDetailResponse: () => deferred.promise })
    renderApp('/')

    for (const name of ['İşi çoğalt', 'İşi düzenle', 'İşi sil', 'İşi tamamla']) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument()
    }

    const editButton = screen.getByRole('button', { name: 'İşi düzenle' })
    expect(editButton).toHaveAttribute('data-no-drag')
    fireEvent.pointerDown(editButton)
    fireEvent.click(editButton)

    const dialog = await screen.findByRole('dialog', { name: 'İşi Düzenle' })
    expect(within(dialog).getByText('İş bilgileri yükleniyor…')).toBeInTheDocument()
    expect(screen.queryByText('İş Önizlemesi')).not.toBeInTheDocument()

    deferred.resolve(jsonResponse({ workItem: makeDetail() }))
    expect(await screen.findByLabelText('Firma İsmi')).toHaveValue(
      'Örnek Firma',
    )
  })

  it('ortak formu edit modunda doldurur, modülü kilitler ve PATCH ile günceller', async () => {
    const detail = makeDetail({
      orderPlacedDate: '2026-09-02',
      orderDeadlineDate: '2026-10-15',
      assignees: [authenticatedAssignee, secondAssignee],
    })
    let submittedBody: unknown
    const api = installAuthenticatedApi({
      getDetail: () => detail,
      getOverview: (requestNumber) =>
        requestNumber === 1
          ? makeOverview()
          : makeOverview([
              makeHomeItem({
                title: 'Güncellenen Ürün',
                companyName: 'Güncellenen Firma',
              }),
            ]),
      onUpdate: (body) => {
        submittedBody = body
        return jsonResponse({
          workItem: makeHomeItem({
            title: 'Güncellenen Ürün',
            companyName: 'Güncellenen Firma',
          }),
        })
      },
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi düzenle' }))
    await screen.findByRole('dialog', { name: 'İşi Düzenle' })
    const companyInput = await screen.findByLabelText('Firma İsmi')
    const dialog = screen.getByRole('dialog', { name: 'İşi Düzenle' })
    const productDetailInput = within(dialog).getByLabelText('Ürün Detay')
    const processStageInput = within(dialog).getByLabelText('Süreç Aşaması')

    await waitFor(() => expect(companyInput).toHaveValue(detail.companyName))
    expect(productDetailInput.tagName).toBe('INPUT')
    expect(productDetailInput).toHaveValue(detail.productDetail)
    expect(productDetailInput.closest('fieldset')).toBe(
      processStageInput.closest('fieldset'),
    )
    expect(within(dialog).getByDisplayValue('Gelen Siparişler')).toHaveAttribute(
      'readonly',
    )
    expect(
      within(dialog)
        .getByDisplayValue('Gelen Siparişler')
        .classList.contains('w-full'),
    ).toBe(true)

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Atanan Kişiler' }),
    )
    expect(
      ((await screen.findByRole('checkbox', {
        name: 'Deniz',
      })) as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: 'Selin' }) as HTMLInputElement)
        .checked,
    ).toBe(true)

    fireEvent.change(companyInput, { target: { value: ' Güncellenen Firma ' } })
    fireEvent.change(within(dialog).getByLabelText('Ürün'), {
      target: { value: ' Güncellenen Ürün ' },
    })
    fireEvent.change(within(dialog).getByLabelText('Sipariş Verilen Tarih'), {
      target: { value: '2026-09-03' },
    })
    expect(within(dialog).getByLabelText('Sipariş Termin Tarihi')).toHaveValue(
      '2026-10-15',
    )

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Değişiklikleri Kaydet' }),
    )

    await waitFor(() => {
      expect(submittedBody).toMatchObject({
        companyName: 'Güncellenen Firma',
        productName: 'Güncellenen Ürün',
        orderDeadlineDate: '2026-10-15',
        assigneeIds: [authenticatedUser.id, secondUser.id],
      })
    })
    expect(submittedBody).not.toHaveProperty('moduleKey')
    expect(submittedBody).not.toHaveProperty('status')
    expect(submittedBody).not.toHaveProperty('createdAt')
    expect(submittedBody).not.toHaveProperty('createdBy')
    await waitFor(() => expect(api.getOverviewRequestCount()).toBe(2))
    expect(screen.queryByRole('dialog', { name: 'İşi Düzenle' })).not.toBeInTheDocument()
    expect(
      await screen.findByRole('button', {
        name: 'Güncellenen Ürün işini görüntüle',
      }),
    ).toBeInTheDocument()
  })

  it('edit hatasında formu açık ve girilen değerleri korunmuş bırakır', async () => {
    installAuthenticatedApi({
      onUpdate: () => jsonResponse({ message: 'Dahili hata' }, 500),
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi düzenle' }))
    await screen.findByRole('dialog', { name: 'İşi Düzenle' })
    const companyInput = await screen.findByLabelText('Firma İsmi')
    const dialog = screen.getByRole('dialog', { name: 'İşi Düzenle' })
    fireEvent.change(companyInput, { target: { value: 'Korunan Firma' } })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Değişiklikleri Kaydet' }),
    )

    expect(
      await within(dialog).findByText('İş güncellenemedi.'),
    ).toBeInTheDocument()
    expect(companyInput).toHaveValue('Korunan Firma')
  })

  it('silme dialogunda işi tanımlar, exact SİL onayı ister ve vazgeçince istek atmaz', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const deleteButton = await screen.findByRole('button', { name: 'İşi sil' })
    expect(deleteButton).toHaveAttribute('data-no-drag')
    fireEvent.click(deleteButton)

    const dialog = await screen.findByRole('dialog', { name: 'İşi Sil' })
    expect(within(dialog).getByText('Deneme Ürünü')).toBeInTheDocument()
    expect(within(dialog).getByText('Örnek Firma')).toBeInTheDocument()
    expect(within(dialog).getByText(/panodan, arşivden ve arama sonuçlarından/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Yorumlar ve hareket geçmişi korunur/)).toBeInTheDocument()

    const confirmation = within(dialog).getByLabelText('Onaylamak için SİL yazın')
    const confirmButton = within(dialog).getByRole('button', { name: 'İşi Sil' })
    expect(confirmButton).toBeDisabled()
    fireEvent.change(confirmation, { target: { value: 'silme' } })
    expect(confirmButton).toBeDisabled()
    fireEvent.change(confirmation, { target: { value: '  sil  ' } })
    expect(confirmButton).not.toBeDisabled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    expect(screen.queryByRole('dialog', { name: 'İşi Sil' })).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) => input === `/api/work-items/${workItemId}` && init?.method === 'DELETE',
      ),
    ).toBe(false)
    expect(screen.queryByText('İş Önizlemesi')).not.toBeInTheDocument()
  })

  it('başarılı soft delete sonrası dialogu kapatır, kartı gizler ve boardu yeniler', async () => {
    let deleteBody: unknown
    const api = installAuthenticatedApi({
      getOverview: (requestNumber) =>
        requestNumber === 1 ? makeOverview() : makeOverview([]),
      onDelete: (body) => {
        deleteBody = body
        return new Response(null, { status: 204 })
      },
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi sil' }))
    const dialog = await screen.findByRole('dialog', { name: 'İşi Sil' })
    fireEvent.change(within(dialog).getByLabelText('Onaylamak için SİL yazın'), {
      target: { value: 'SİL' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Sil' }))

    await waitFor(() => expect(deleteBody).toEqual({ confirmation: 'SİL' }))
    expect(screen.queryByRole('dialog', { name: 'İşi Sil' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Deneme Ürünü işini görüntüle' }),
    ).not.toBeInTheDocument()
    await waitFor(() => expect(api.getOverviewRequestCount()).toBe(2))
  })

  it('delete hatasında dialogu ve girdiyi korur', async () => {
    installAuthenticatedApi({
      onDelete: () => jsonResponse({ message: 'Dahili hata' }, 500),
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi sil' }))
    const dialog = await screen.findByRole('dialog', { name: 'İşi Sil' })
    const confirmation = within(dialog).getByLabelText('Onaylamak için SİL yazın')
    fireEvent.change(confirmation, { target: { value: 'SİL' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Sil' }))

    expect(await within(dialog).findByText('İş silinemedi.')).toBeInTheDocument()
    expect(confirmation).toHaveValue('SİL')
    expect(screen.getByRole('dialog', { name: 'İşi Sil' })).toBeInTheDocument()
  })

  it('delete pending sırasında dialogu kilitler ve çift isteği engeller', async () => {
    const deferred = createDeferredResponse()
    let deleteRequestCount = 0
    installAuthenticatedApi({
      onDelete: () => {
        deleteRequestCount += 1
        return deferred.promise
      },
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi sil' }))
    const dialog = await screen.findByRole('dialog', { name: 'İşi Sil' })
    fireEvent.change(within(dialog).getByLabelText('Onaylamak için SİL yazın'), {
      target: { value: 'SİL' },
    })
    const confirmButton = within(dialog).getByRole('button', { name: 'İşi Sil' })
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)

    expect(deleteRequestCount).toBe(1)
    expect(confirmButton).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Vazgeç' })).toBeDisabled()

    deferred.resolve(new Response(null, { status: 204 }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'İşi Sil' })).not.toBeInTheDocument()
    })
  })
})

describe('Phase 02D inline yanıt ve yorum tepkisi arayüzü', () => {
  const rootComment = makeComment('30000000-0000-4000-8000-000000000101', {
    body: 'Ana sosyal yorum.',
    reactionCount: 2,
    replies: [
      {
        id: '30000000-0000-4000-8000-000000000102',
        body: 'Sosyal yanıt.',
        createdAt: '2026-09-15T09:15:00.000Z',
        author: makeDetail().createdBy,
        reactionCount: 1,
        reactedByCurrentUser: true,
      },
    ],
  })

  it('yorum, yanıt ve nötr etkinlik alanlarını ayırıp doğru aksiyonları gösterir', async () => {
    installAuthenticatedApi({
      getDetail: () => makeDetail({ comments: [rootComment], events: [makeEvent({})] }),
    })
    renderApp('/')
    const dialog = await openWorkItemPreview()

    expect(within(dialog).getByRole('heading', { name: 'Yeni Yorum' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Yorumlar' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Etkinlik Geçmişi' })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: 'Yanıtla' })).toHaveLength(1)
    expect(
      within(dialog).getByRole('button', { name: 'Yoruma onay tepkisi ver' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      within(dialog).getByRole('button', { name: 'Onay tepkisini kaldır' }),
    ).toHaveAttribute('aria-pressed', 'true')

    const events = within(dialog).getByRole('list', { name: 'İş aktivite geçmişi' })
    expect(within(events).queryByRole('button', { name: 'Yanıtla' })).not.toBeInTheDocument()
    expect(within(events).queryByRole('button', { name: /onay tepkisi/i })).not.toBeInTheDocument()
  })

  it('yanıt formunu ilgili ana yorum altında açar, top formu değiştirmez ve iptal eder', async () => {
    const secondComment = makeComment('30000000-0000-4000-8000-000000000103', {
      body: 'İkinci ana yorum.',
    })
    installAuthenticatedApi({
      getDetail: () => makeDetail({ comments: [rootComment, secondComment] }),
    })
    renderApp(`/isler/${workItemId}`)

    const topTextarea = await screen.findByLabelText('Yeni Yorum')
    const replyButtons = screen.getAllByRole('button', { name: 'Yanıtla' })
    fireEvent.click(replyButtons[0])
    const firstInline = screen.getByPlaceholderText('Yanıtınızı yazın…')
    await waitFor(() => expect(firstInline).toHaveFocus())
    expect(topTextarea).not.toHaveFocus()
    expect(firstInline.closest('li')).toHaveTextContent('Ana sosyal yorum.')
    expect(screen.getAllByPlaceholderText('Yanıtınızı yazın…')).toHaveLength(1)

    fireEvent.change(firstInline, { target: { value: 'Geçici yanıt' } })
    fireEvent.click(replyButtons[1])
    const secondInline = screen.getByPlaceholderText('Yanıtınızı yazın…')
    expect(secondInline).toHaveValue('')
    expect(secondInline.closest('li')).toHaveTextContent('İkinci ana yorum.')
    expect(screen.getAllByPlaceholderText('Yanıtınızı yazın…')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Yanıtı İptal Et' }))
    expect(screen.queryByPlaceholderText('Yanıtınızı yazın…')).not.toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          input === `/api/work-items/${workItemId}/comments` && init?.method === 'POST',
      ),
    ).toBe(false)
  })

  it('boş inline yanıtı reddeder, başarılı yanıtı doğru parent ile gönderip formu kapatır', async () => {
    let submittedBody: unknown
    let currentDetail = makeDetail({ comments: [rootComment] })
    installAuthenticatedApi({
      getDetail: () => currentDetail,
      onComment: (body) => {
        submittedBody = body
        currentDetail = {
          ...currentDetail,
          comments: [
            {
              ...rootComment,
              replies: [
                ...rootComment.replies,
                {
                  id: '30000000-0000-4000-8000-000000000104',
                  body: 'Yeni doğru yanıt.',
                  createdAt: '2026-09-15T10:00:00.000Z',
                  author: makeDetail().createdBy,
                  reactionCount: 0,
                  reactedByCurrentUser: false,
                },
              ],
            },
          ],
        }
        return jsonResponse({
          comment: {
            id: '30000000-0000-4000-8000-000000000104',
            body: 'Yeni doğru yanıt.',
            createdAt: '2026-09-15T10:00:00.000Z',
            author: makeDetail().createdBy,
            parentCommentId: rootComment.id,
          },
        }, 201)
      },
    })
    renderApp(`/isler/${workItemId}`)

    fireEvent.click(await screen.findByRole('button', { name: 'Yanıtla' }))
    const inline = screen.getByPlaceholderText('Yanıtınızı yazın…')
    const submit = screen.getByRole('button', { name: 'Yanıt Ekle' })
    expect(submit).toBeDisabled()
    fireEvent.change(inline, { target: { value: '   ' } })
    expect(submit).toBeDisabled()
    fireEvent.change(inline, { target: { value: '  Yeni doğru yanıt.  ' } })
    fireEvent.click(submit)

    await waitFor(() => {
      expect(submittedBody).toEqual({
        body: 'Yeni doğru yanıt.',
        parentCommentId: rootComment.id,
      })
    })
    expect(screen.queryByPlaceholderText('Yanıtınızı yazın…')).not.toBeInTheDocument()
    expect(await screen.findByText('Yeni doğru yanıt.')).toBeInTheDocument()
    expect(screen.getByLabelText('Yeni Yorum')).toHaveValue('')
  })

  it('eski yanıt isteği çözülürken başka yorumda açılan yeni taslağı korur', async () => {
    const secondComment = makeComment('30000000-0000-4000-8000-000000000105', {
      body: 'Yeni taslağın bağlı olduğu yorum.',
    })
    const deferred = createDeferredResponse()
    let replyRequestCount = 0
    const api = installAuthenticatedApi({
      getDetail: () => makeDetail({ comments: [rootComment, secondComment] }),
      onComment: () => {
        replyRequestCount += 1
        return deferred.promise
      },
    })
    renderApp(`/isler/${workItemId}`)

    const replyButtons = await screen.findAllByRole('button', { name: 'Yanıtla' })
    fireEvent.click(replyButtons[0])
    fireEvent.change(screen.getByPlaceholderText('Yanıtınızı yazın…'), {
      target: { value: 'Gönderilmekte olan eski yanıt.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yanıt Ekle' }))
    expect(replyRequestCount).toBe(1)

    fireEvent.click(replyButtons[1])
    const currentDraft = screen.getByPlaceholderText('Yanıtınızı yazın…')
    fireEvent.change(currentDraft, {
      target: { value: 'Korunması gereken yeni taslak.' },
    })

    deferred.resolve(
      jsonResponse(
        {
          comment: {
            id: '30000000-0000-4000-8000-000000000106',
            body: 'Gönderilmekte olan eski yanıt.',
            createdAt: '2026-09-15T10:05:00.000Z',
            author: makeDetail().createdBy,
            parentCommentId: rootComment.id,
          },
        },
        201,
      ),
    )

    await waitFor(() => expect(api.getDetailRequestCount()).toBe(2))
    expect(screen.getByPlaceholderText('Yanıtınızı yazın…')).toHaveValue(
      'Korunması gereken yeni taslak.',
    )
  })

  it('inactive ana yorum tepkisini PUT ile ekleyip sayıyı günceller', async () => {
    let reactionCall: { commentId: string; method: string } | null = null
    installAuthenticatedApi({
      getDetail: () => makeDetail({ comments: [rootComment] }),
      onReaction: (commentId, method) => {
        reactionCall = { commentId, method }
        return jsonResponse({ reactionCount: 3, reactedByCurrentUser: true })
      },
    })
    renderApp(`/isler/${workItemId}`)

    const button = await screen.findByRole('button', {
      name: 'Yoruma onay tepkisi ver',
    })
    expect(button).toHaveTextContent('2')
    fireEvent.click(button)

    await waitFor(() => expect(reactionCall).toEqual({ commentId: rootComment.id, method: 'PUT' }))
    let activeButton: HTMLElement | undefined
    await waitFor(() => {
      activeButton = screen
        .getAllByRole('button', { name: 'Onay tepkisini kaldır' })
        .find((candidate) => candidate.textContent === '3')
      expect(activeButton).toBeDefined()
    })
    if (!activeButton) {
      throw new Error('Güncellenen tepki butonu bulunamadı.')
    }
    expect(activeButton).toHaveTextContent('3')
    expect(activeButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('active reply tepkisini DELETE ile kaldırır ve completed işte de çalışır', async () => {
    let reactionCall: { commentId: string; method: string } | null = null
    installAuthenticatedApi({
      getDetail: () =>
        makeDetail({
          status: 'completed',
          completedAt: '2026-09-15T10:00:00.000Z',
          completedBy: makeDetail().createdBy,
          comments: [rootComment],
        }),
      onReaction: (commentId, method) => {
        reactionCall = { commentId, method }
        return jsonResponse({ reactionCount: 0, reactedByCurrentUser: false })
      },
    })
    renderApp(`/isler/${workItemId}`)

    const button = await screen.findByRole('button', {
      name: 'Onay tepkisini kaldır',
    })
    fireEvent.click(button)

    await waitFor(() =>
      expect(reactionCall).toEqual({
        commentId: rootComment.replies[0].id,
        method: 'DELETE',
      }),
    )
    expect(
      await screen.findAllByRole('button', { name: 'Yoruma onay tepkisi ver' }),
    ).toHaveLength(2)
  })

  it('tepki hatasında mevcut count ve pressed durumunu korur', async () => {
    installAuthenticatedApi({
      getDetail: () => makeDetail({ comments: [rootComment] }),
      onReaction: () => jsonResponse({ message: 'Dahili hata' }, 500),
    })
    renderApp(`/isler/${workItemId}`)

    const button = await screen.findByRole('button', {
      name: 'Yoruma onay tepkisi ver',
    })
    fireEvent.click(button)

    expect(await screen.findByText('Tepki güncellenemedi.')).toBeInTheDocument()
    expect(button).toHaveTextContent('2')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('tepki isteği pending iken butonu kilitleyip çift isteği engeller', async () => {
    const deferred = createDeferredResponse()
    let reactionRequestCount = 0
    installAuthenticatedApi({
      getDetail: () => makeDetail({ comments: [rootComment] }),
      onReaction: () => {
        reactionRequestCount += 1
        return deferred.promise
      },
    })
    renderApp(`/isler/${workItemId}`)

    const button = await screen.findByRole('button', {
      name: 'Yoruma onay tepkisi ver',
    })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(reactionRequestCount).toBe(1)
    expect(button).toBeDisabled()

    deferred.resolve(jsonResponse({ reactionCount: 3, reactedByCurrentUser: true }))
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name: 'Onay tepkisini kaldır' })
          .some((candidate) => candidate.textContent === '3'),
      ).toBe(true)
    })
  })
})

describe('Phase 03A ortak akıllı otomatik tamamlama form akışı', () => {
  it('create formunda yalnız altı ana veri alanını combobox olarak sunar', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()

    for (const label of [
      'Firma İsmi',
      'Ürün',
      'Ambalaj Türü',
      'Tedarikçi Firma',
      'Sipariş Cinsi',
      'Süreç Aşaması',
    ]) {
      expect(
        within(dialog).getByRole('combobox', { name: label }),
      ).toBeInTheDocument()
    }

    for (const label of [
      'Sipariş Kodu',
      'Stok',
      'İhtiyaç/Sipariş',
      'Ürün Detay',
    ]) {
      expect(within(dialog).getByLabelText(label)).not.toHaveAttribute(
        'role',
        'combobox',
      )
    }
  })

  it('product önerisinde firma bağlamını gönderir ve seçilen değeri create payloadına taşır', async () => {
    let suggestionUrl: URL | null = null
    let suggestionInit: RequestInit | undefined
    let submittedBody: unknown
    installAuthenticatedApi({
      onMasterDataSuggestions: (url, init) => {
        suggestionUrl = url
        suggestionInit = init
        return jsonResponse({
          suggestions: [
            {
              id: '50000000-0000-4000-8000-000000000001',
              kind: 'product',
              value: 'Sentetik Seçilen Ürün',
            },
          ],
        })
      },
      onCreate: (body) => {
        submittedBody = body
        return jsonResponse({ workItem: makeHomeItem() }, 201)
      },
    })
    renderApp('/')

    const dialog = await openCreateDialog()
    fireEvent.change(within(dialog).getByLabelText('Firma İsmi'), {
      target: { value: '  Sentetik Firma  ' },
    })
    const productInput = within(dialog).getByLabelText('Ürün')
    fireEvent.focus(productInput)
    fireEvent.change(productInput, { target: { value: 'Sentetik' } })

    fireEvent.click(
      await screen.findByRole('option', { name: 'Sentetik Seçilen Ürün' }),
    )
    expect(suggestionUrl).not.toBeNull()
    const observedSuggestionUrl =
      suggestionUrl ?? new URL('http://localhost/geçersiz')
    expect(observedSuggestionUrl.searchParams.get('kind')).toBe('product')
    expect(observedSuggestionUrl.searchParams.get('q')).toBe('Sentetik')
    expect(observedSuggestionUrl.searchParams.get('company')).toBe(
      'Sentetik Firma',
    )
    expect(suggestionInit).toEqual(
      expect.objectContaining({ credentials: 'include' }),
    )

    fireEvent.click(within(dialog).getByRole('button', { name: 'İşi Oluştur' }))
    await waitFor(() => {
      expect(submittedBody).toMatchObject({
        companyName: 'Sentetik Firma',
        productName: 'Sentetik Seçilen Ürün',
      })
    })
  })

  it('üst bağlam alanları değiştiğinde girilmiş alt alan değerlerini temizlemez', async () => {
    installAuthenticatedApi()
    renderApp('/')

    const dialog = await openCreateDialog()
    const productInput = within(dialog).getByLabelText('Ürün')
    const packagingInput = within(dialog).getByLabelText('Ambalaj Türü')
    const supplierInput = within(dialog).getByLabelText('Tedarikçi Firma')
    const orderTypeInput = within(dialog).getByLabelText('Sipariş Cinsi')

    fireEvent.change(productInput, { target: { value: 'Korunan Ürün' } })
    fireEvent.change(packagingInput, { target: { value: 'Korunan Ambalaj' } })
    fireEvent.change(supplierInput, { target: { value: 'Korunan Tedarikçi' } })
    fireEvent.change(orderTypeInput, { target: { value: 'Korunan Sipariş Cinsi' } })
    fireEvent.change(within(dialog).getByLabelText('Firma İsmi'), {
      target: { value: 'Değişen Firma' },
    })
    fireEvent.change(productInput, { target: { value: 'Değişen Ürün' } })

    expect(packagingInput).toHaveValue('Korunan Ambalaj')
    expect(supplierInput).toHaveValue('Korunan Tedarikçi')
    expect(orderTypeInput).toHaveValue('Korunan Sipariş Cinsi')
  })

  it('duplicate modunda öneriyi seçer ve mevcut ambalaj bağlamıyla POST eder', async () => {
    let suggestionUrl: URL | null = null
    let submittedBody: unknown
    installAuthenticatedApi({
      onMasterDataSuggestions: (url) => {
        suggestionUrl = url
        return jsonResponse({
          suggestions: [
            {
              id: '50000000-0000-4000-8000-000000000002',
              kind: 'supplier',
              value: 'Sentetik Yeni Tedarikçi',
            },
          ],
        })
      },
      onCreate: (body) => {
        submittedBody = body
        return jsonResponse({ workItem: makeHomeItem() }, 201)
      },
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi çoğalt' }))
    const dialog = await screen.findByRole('dialog', { name: 'İşi Çoğalt' })
    const supplierInput = await within(dialog).findByLabelText(
      'Tedarikçi Firma',
    )
    fireEvent.focus(supplierInput)

    fireEvent.click(
      await screen.findByRole('option', { name: 'Sentetik Yeni Tedarikçi' }),
    )
    expect((suggestionUrl as URL | null)?.searchParams.get('kind')).toBe(
      'supplier',
    )
    expect((suggestionUrl as URL | null)?.searchParams.get('packagingType')).toBe(
      'Kutu',
    )

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Kopyayı Oluştur' }),
    )
    await waitFor(() => {
      expect(submittedBody).toMatchObject({
        moduleKey: 'incoming-orders',
        supplierCompany: 'Sentetik Yeni Tedarikçi',
      })
    })
  })

  it('edit modunda süreç önerisini seçer ve moduleKey eklemeden PATCH eder', async () => {
    let submittedBody: unknown
    installAuthenticatedApi({
      onMasterDataSuggestions: () =>
        jsonResponse({
          suggestions: [
            {
              id: '50000000-0000-4000-8000-000000000003',
              kind: 'process_stage',
              value: 'Sentetik Kontrol Aşaması',
            },
          ],
        }),
      onUpdate: (body) => {
        submittedBody = body
        return jsonResponse({ workItem: makeHomeItem() })
      },
    })
    renderApp('/')

    fireEvent.click(await screen.findByRole('button', { name: 'İşi düzenle' }))
    await screen.findByRole('dialog', { name: 'İşi Düzenle' })
    const processStageInput = await screen.findByLabelText(
      'Süreç Aşaması',
      {},
      { timeout: 3_000 },
    )
    const dialog = screen.getByRole('dialog', { name: 'İşi Düzenle' })
    fireEvent.focus(processStageInput)

    fireEvent.click(
      await screen.findByRole('option', {
        name: 'Sentetik Kontrol Aşaması',
      }),
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Değişiklikleri Kaydet' }),
    )

    await waitFor(() => {
      expect(submittedBody).toMatchObject({
        processStage: 'Sentetik Kontrol Aşaması',
      })
    })
    expect(submittedBody).not.toHaveProperty('moduleKey')
  })
})
