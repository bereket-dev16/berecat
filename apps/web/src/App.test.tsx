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
import App from './App'
import type { HomeItem, HomeOverview } from './features/home/home-types'

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
    description,
    dueDate: '2026-09-08',
    assignees: [{ id: 'eren', displayName: 'Eren' }],
  }
}

const firstItem = makeItem(
  'item-1',
  'Ürün broşürü talebi',
  'Yeni ürün için ön ve arka yüz broşür tasarımı hazırlanacak.',
)

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
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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
  })

  it('başarılı girişten sonra korumalı anasayfayı açar', async () => {
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
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/home/overview',
      expect.objectContaining({ credentials: 'include' }),
    )
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

  it('iş kartına basıldığında salt okunur modalı açar', async () => {
    mockAuthenticatedHome()

    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ürün broşürü talebi işini görüntüle',
      }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: firstItem.title })).toBeInTheDocument()
    expect(within(dialog).getByText(firstItem.description)).toBeInTheDocument()
    expect(within(dialog).getByText('Teslim Tarihi')).toBeInTheDocument()
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
    mockAuthenticatedHome()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    renderApp('/')

    await screen.findByRole('region', { name: 'BereCat modülleri' })
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
  })
})
