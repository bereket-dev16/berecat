import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { MemoryRouter } from 'react-router'
import App from './App'
import { stopIntroAudio } from './features/audio/intro-audio'
import type { HomeItem, HomeOverview } from './features/home/home-types'
import type { WorkItemDetail } from './features/work-items/work-item-types'

const playAudioMock = vi.spyOn(HTMLMediaElement.prototype, 'play')
const pauseAudioMock = vi.spyOn(HTMLMediaElement.prototype, 'pause')

const demoUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'eren',
  displayName: 'Eren',
  role: 'member',
  team: 'graphic',
} as const

const moduleTitles = [
  'Gelen Siparişler',
  'Yeni Tasarımlar',
  'Revizeler',
  'Ekip Onayı',
  'Müşteri Onayı (Mail)',
  'Fiyatlandırma',
  'Dijital',
]

function makeItem(id: string, title: string, description: string): HomeItem {
  return {
    id,
    title,
    companyName: 'Örnek Firma',
    description,
    dueDate: '2026-09-08',
    status: 'active',
    completedAt: null,
    assignees: [{ id: 'eren', displayName: 'Eren' }],
  }
}

const firstItem = makeItem(
  'item-1',
  'Ürün broşürü talebi',
  'Yeni ürün için ön ve arka yüz broşür tasarımı hazırlanacak.',
)

function makeDetailForItem(item: HomeItem): WorkItemDetail {
  return {
    id: item.id,
    moduleKey: 'incoming-orders',
    moduleTitle: 'Gelen Siparişler',
    orderCode: null,
    companyName: item.companyName,
    productName: item.title,
    packagingType: null,
    supplierCompany: null,
    orderType: null,
    stockValue: null,
    needOrderValue: null,
    orderedQuantity: null,
    receivedQuantity: null,
    orderReceivedDate: null,
    orderPlacedDate: null,
    orderDeadlineDate: item.dueDate,
    orderShipmentDate: null,
    processStage: null,
    productDetail: item.description,
    status: item.status,
    completedAt: item.completedAt,
    completedBy: null,
    assignees: [
      {
        id: demoUser.id,
        username: demoUser.username,
        displayName: demoUser.displayName,
        team: demoUser.team,
      },
    ],
    createdBy: {
      id: demoUser.id,
      username: demoUser.username,
      displayName: demoUser.displayName,
    },
    createdAt: '2026-09-08T08:00:00.000Z',
    updatedAt: '2026-09-08T08:00:00.000Z',
    comments: [
      {
        id: 'comment-1',
        body: 'Önizleme için test yorumu.',
        createdAt: '2026-09-08T08:30:00.000Z',
        author: {
          id: demoUser.id,
          username: demoUser.username,
          displayName: demoUser.displayName,
        },
        reactionCount: 0,
        reactedByCurrentUser: false,
        replies: [],
      },
    ],
    events: [],
  }
}

const demoOverview: HomeOverview = {
  modules: [
    { id: 'incoming-orders', title: moduleTitles[0], items: [firstItem] },
    {
      id: 'new-designs',
      title: moduleTitles[1],
      items: [makeItem('item-2', 'Sosyal medya gönderisi', 'Test açıklaması.')],
    },
    {
      id: 'revisions',
      title: moduleTitles[2],
      items: [makeItem('item-3', 'Ambalaj metin revizesi', 'Test açıklaması.')],
    },
    {
      id: 'team-approval',
      title: moduleTitles[3],
      items: [makeItem('item-4', 'Kampanya görsel seti', 'Test açıklaması.')],
    },
    { id: 'customer-approval-mail', title: moduleTitles[4], items: [] },
    {
      id: 'pricing',
      title: moduleTitles[5],
      items: [makeItem('item-5', 'Katalog baskı teklifi', 'Test açıklaması.')],
    },
    {
      id: 'digital',
      title: moduleTitles[6],
      items: [makeItem('item-6', 'Web sitesi banner güncellemesi', 'Test açıklaması.')],
    },
  ],
}

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createDeferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function mockUnauthenticatedSession() {
  fetchMock.mockResolvedValueOnce(jsonResponse({ user: null }))
}

function mockAuthenticatedHome() {
  fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))
  fetchMock.mockResolvedValueOnce(jsonResponse(demoOverview))
}

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText('Kullanıcı adı'), {
    target: { value: 'eren' },
  })
  fireEvent.change(screen.getByLabelText('Şifre'), {
    target: { value: 'guvenli-deneme-parolasi' },
  })
}

beforeEach(() => {
  stopIntroAudio()
  playAudioMock.mockReset().mockResolvedValue(undefined)
  pauseAudioMock.mockReset().mockImplementation(() => undefined)
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

afterAll(() => {
  stopIntroAudio()
  playAudioMock.mockRestore()
  pauseAudioMock.mockRestore()
})

describe('BereCat authentication akışı', () => {
  it('login ekranını kullanıcı adı ve şifre alanlarıyla gösterir', async () => {
    mockUnauthenticatedSession()

    renderApp('/login')

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Kullanıcı adı')).toHaveAttribute(
      'autocomplete',
      'username',
    )
    expect(screen.getByLabelText('Şifre')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(screen.getByRole('img', { name: 'BereCat' })).toHaveAttribute(
      'src',
      '/brand/berecat-logo.png',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(playAudioMock).not.toHaveBeenCalled()
    expect(pauseAudioMock).not.toHaveBeenCalled()
  })

  it('şifreyi gösterip yeniden gizler', async () => {
    mockUnauthenticatedSession()

    renderApp('/login')

    const passwordInput = await screen.findByLabelText('Şifre')
    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi gizle' }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('hatalı girişte yalnızca genel mesajı gösterir', async () => {
    mockUnauthenticatedSession()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Kullanıcı adı veya şifre hatalı.' }, 401),
    )

    renderApp('/login')

    await screen.findByLabelText('Kullanıcı adı')
    fillLoginForm()
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kullanıcı adı veya şifre hatalı.',
    )
    expect(playAudioMock).toHaveBeenCalled()
    expect(pauseAudioMock).toHaveBeenCalledTimes(1)

    const stoppedAudio = pauseAudioMock.mock.instances.at(-1) as HTMLAudioElement
    expect(stoppedAudio.currentTime).toBe(0)
    expect(stoppedAudio.muted).toBe(true)
  })

  it('başarılı girişten sonra korumalı anasayfayı açar', async () => {
    const loginResponse = createDeferredResponse()

    mockUnauthenticatedSession()
    fetchMock.mockImplementationOnce(() => loginResponse.promise)
    fetchMock.mockResolvedValueOnce(jsonResponse(demoOverview))

    renderApp('/login')

    await screen.findByLabelText('Kullanıcı adı')
    fillLoginForm()
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))

    expect(playAudioMock).toHaveBeenCalled()
    expect(playAudioMock.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[1],
    )

    const preparedAudio = playAudioMock.mock.instances.at(-1) as HTMLAudioElement
    expect(preparedAudio.currentTime).toBe(0)
    expect(preparedAudio.muted).toBe(true)

    loginResponse.resolve(jsonResponse({ user: demoUser }))

    expect(
      await screen.findByRole('region', { name: 'BereCat modülleri' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/home/overview',
      expect.objectContaining({ credentials: 'include' }),
    )

    const playingAudio = playAudioMock.mock.instances.at(-1) as HTMLAudioElement
    expect(playingAudio.src).toContain('/audio/berecat-intro.mp3')
    expect(playingAudio.preload).toBe('auto')
    expect(playingAudio.loop).toBe(false)
    expect(playingAudio.currentTime).toBe(0)
    expect(playingAudio.muted).toBe(false)
    expect(playingAudio.volume).toBe(0.35)
  })

  it('session yokken kök adresinden login ekranına yönlendirir', async () => {
    mockUnauthenticatedSession()

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Anasayfa' })).not.toBeInTheDocument()
  })

  it('geçerli session ile login adresinden anasayfaya yönlendirir', async () => {
    mockAuthenticatedHome()

    renderApp('/login')

    expect(
      await screen.findByRole('heading', { name: 'Anasayfa' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Kullanıcı adı')).not.toBeInTheDocument()
    expect(playAudioMock).not.toHaveBeenCalled()
    expect(pauseAudioMock).not.toHaveBeenCalled()
  })

  it('audio oynatma reddedilse de başarılı giriş ve yönlendirme devam eder', async () => {
    playAudioMock.mockRejectedValue(new Error('Oynatma engellendi.'))
    mockUnauthenticatedSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse(demoOverview))

    renderApp('/login')

    await screen.findByLabelText('Kullanıcı adı')
    fillLoginForm()
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))

    expect(
      await screen.findByRole('region', { name: 'BereCat modülleri' }),
    ).toBeInTheDocument()
    expect(playAudioMock).toHaveBeenCalled()
  })
})

describe('BereCat anasayfa akışı', () => {
  it('authenticated kullanıcı için anasayfayı render eder', async () => {
    mockAuthenticatedHome()

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Anasayfa' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menüyü aç' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Çıkış yap' })).toBeInTheDocument()
    expect(playAudioMock).not.toHaveBeenCalled()
  })

  it('yedi modülü API sırasıyla gösterir', async () => {
    mockAuthenticatedHome()

    renderApp('/')

    const board = await screen.findByRole('region', {
      name: 'BereCat modülleri',
    })
    const headings = within(board).getAllByRole('heading', { level: 2 })

    expect(headings.map((heading) => heading.textContent)).toEqual(moduleTitles)
  })

  it('Müşteri Onayı modülünde empty state gösterir', async () => {
    mockAuthenticatedHome()

    renderApp('/')

    const moduleHeading = await screen.findByRole('heading', {
      name: 'Müşteri Onayı (Mail)',
    })
    const moduleSection = moduleHeading.closest('section')

    expect(moduleSection).not.toBeNull()
    expect(within(moduleSection as HTMLElement).getByText('Henüz iş yok.')).toBeInTheDocument()
  })

  it('iş kartına basıldığında güncel detail modalını açar', async () => {
    mockAuthenticatedHome()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ workItem: makeDetailForItem(firstItem) }),
    )

    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ürün broşürü talebi işini görüntüle',
      }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: firstItem.title })).toBeInTheDocument()
    expect(
      await within(dialog).findByText(firstItem.description ?? ''),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Sipariş Termin Tarihi'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Atanan Kişiler')).toBeInTheDocument()
  })

  it('Escape ile iş önizleme modalını kapatır', async () => {
    mockAuthenticatedHome()

    renderApp('/')

    const itemTrigger = await screen.findByRole('button', {
      name: 'Ürün broşürü talebi işini görüntüle',
    })

    fireEvent.click(itemTrigger)
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(itemTrigger)
    })
  })

  it('overlaye basıldığında iş önizleme modalını kapatır', async () => {
    mockAuthenticatedHome()

    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ürün broşürü talebi işini görüntüle',
      }),
    )
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByTestId('work-item-dialog-overlay'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('sidebarı overlay, Escape ve kapatma butonuyla kapatır', async () => {
    mockAuthenticatedHome()

    renderApp('/')

    const openMenuButton = await screen.findByRole('button', {
      name: 'Menüyü aç',
    })

    fireEvent.click(openMenuButton)
    fireEvent.click(screen.getByTestId('sidebar-overlay'))
    expect(screen.queryByRole('dialog', { name: 'BereCat' })).not.toBeInTheDocument()

    fireEvent.click(openMenuButton)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'BereCat' })).not.toBeInTheDocument()
      expect(document.activeElement).toBe(openMenuButton)
    })

    fireEvent.click(openMenuButton)
    expect(screen.getByRole('dialog', { name: 'BereCat' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Menüyü kapat' }))
    expect(screen.queryByRole('dialog', { name: 'BereCat' })).not.toBeInTheDocument()
  })

  it('veri beklenirken anasayfa skeletonını gösterir', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))
    fetchMock.mockImplementationOnce(() => new Promise(() => undefined))

    renderApp('/')

    expect(
      await screen.findByRole('status', { name: 'Anasayfa yükleniyor' }),
    ).toBeInTheDocument()
  })

  it('genel hata gösterir ve Tekrar Dene ile yeniden veri yükler', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500))
    fetchMock.mockResolvedValueOnce(jsonResponse(demoOverview))

    renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Anasayfa verileri yüklenemedi.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }))

    expect(
      await screen.findByRole('region', { name: 'BereCat modülleri' }),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([input]) => input === '/api/home/overview'),
    ).toHaveLength(2)
  })

  it('anasayfa 401 döndürdüğünde login ekranına yönlendirir', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401))

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
  })

  it('çıkış işlemi sonrasında login ekranına döner', async () => {
    mockUnauthenticatedSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))
    fetchMock.mockResolvedValueOnce(jsonResponse(demoOverview))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    renderApp('/login')

    await screen.findByLabelText('Kullanıcı adı')
    fillLoginForm()
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))
    await screen.findByRole('region', { name: 'BereCat modülleri' })

    const playingAudio = playAudioMock.mock.instances.at(-1) as HTMLAudioElement
    playingAudio.currentTime = 4

    fireEvent.click(screen.getByRole('button', { name: 'Çıkış yap' }))

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
    expect(pauseAudioMock).toHaveBeenCalledTimes(1)
    expect(playingAudio.currentTime).toBe(0)
    expect(playingAudio.muted).toBe(true)
  })
})
