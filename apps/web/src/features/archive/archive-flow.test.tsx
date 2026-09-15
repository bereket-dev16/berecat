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
import type {
  ArchiveSuggestion,
  ArchiveWorkItem,
} from './archive-types'

const sessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'eren',
  displayName: 'Eren',
  role: 'member',
  team: 'graphic',
} as const

const secondUser = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'talha',
  displayName: 'Talha',
  role: 'member',
  team: 'digital',
} as const

const archivedItem: ArchiveWorkItem = {
  id: '10000000-0000-4000-8000-000000000001',
  orderCode: 'SIP-2026-014',
  companyName: 'Acme İlaç',
  productName: 'Viabor Boron Complex',
  packagingType: 'Kutu',
  orderType: 'Üretim',
  orderedQuantity: '12.000',
  moduleKey: 'team-approval',
  moduleTitle: 'Ekip Onayı',
  completedAt: '2026-09-14T10:30:00.000Z',
  completedBy: {
    id: sessionUser.id,
    displayName: sessionUser.displayName,
    username: sessionUser.username,
  },
}

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function archiveResponse(
  items: ArchiveWorkItem[] = [archivedItem],
  overrides: Partial<{
    page: number
    pageSize: number
    total: number
    totalPages: number
  }> = {},
) {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 25,
      total: items.length,
      totalPages: items.length ? 1 : 0,
      ...overrides,
    },
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  return input instanceof URL ? input.toString() : input.url
}

function callsFor(path: string) {
  return fetchMock.mock.calls.filter(([input]) => requestUrl(input).startsWith(path))
}

function installDefaultFetch(
  archiveHandler: (
    url: URL,
    init: RequestInit | undefined,
  ) => Response | Promise<Response> = () => jsonResponse(archiveResponse()),
  suggestionHandler: (
    url: URL,
    init: RequestInit | undefined,
  ) => Response | Promise<Response> = () =>
    jsonResponse({ suggestions: [] }),
  reopenHandler: () => Response | Promise<Response> = () =>
    jsonResponse({ workItem: {} }),
) {
  fetchMock.mockImplementation((input, init) => {
    const rawUrl = requestUrl(input)
    const url = new URL(rawUrl, 'http://localhost')

    if (url.pathname === '/api/auth/session') {
      return Promise.resolve(jsonResponse({ user: sessionUser }))
    }

    if (url.pathname === '/api/users/options') {
      return Promise.resolve(jsonResponse({ users: [sessionUser, secondUser] }))
    }

    if (url.pathname === '/api/archive/work-items') {
      return Promise.resolve(archiveHandler(url, init))
    }

    if (url.pathname === '/api/archive/suggestions') {
      return Promise.resolve(suggestionHandler(url, init))
    }

    if (
      url.pathname === `/api/work-items/${archivedItem.id}/reopen` &&
      init?.method === 'POST'
    ) {
      return Promise.resolve(reopenHandler())
    }

    return Promise.resolve(jsonResponse({}, 500))
  })
}

function renderArchive() {
  return render(
    <MemoryRouter initialEntries={['/arsiv']}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Phase 02C arşiv akışı', () => {
  it('korumalı route üzerinde AppShell ve tamamlanan işler tablosunu gösterir', async () => {
    installDefaultFetch()

    renderArchive()

    expect(
      await screen.findByRole('heading', { name: 'Tamamlanan İşler' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Arşiv' })).toBeInTheDocument()
    const breadcrumb = screen.getByRole('navigation', { name: 'Sayfa yolu' })
    expect(
      within(breadcrumb).getByRole('link', { name: 'Anasayfaya Dön' }),
    ).toHaveAttribute('href', '/')

    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('link', {
        name: 'BereCat anasayfasına git',
      }),
    ).toHaveAttribute('href', '/')

    const table = await screen.findByRole('table', {
      name: 'Tamamlanan işler arşivi',
    })
    expect(screen.getByText('Acme İlaç')).toBeInTheDocument()
    expect(screen.getByText('Viabor Boron Complex')).toBeInTheDocument()
    expect(screen.getByText('SIP-2026-014')).toBeInTheDocument()
    expect(screen.getAllByText('Ekip Onayı')).toHaveLength(2)
    expect(within(table).getByText('@eren')).toBeInTheDocument()
    expect(within(header).queryByText('@eren')).not.toBeInTheDocument()

    const listCall = callsFor('/api/archive/work-items').at(0)
    const usersCall = callsFor('/api/users/options').at(0)
    expect(listCall?.[1]).toEqual(
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(usersCall?.[1]).toEqual(
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('sidebar içinde yalnız çalışan Anasayfa ve Arşiv linklerini gösterip aktif routeu belirtir', async () => {
    installDefaultFetch()
    renderArchive()

    await screen.findByRole('heading', { name: 'Tamamlanan İşler' })
    fireEvent.click(screen.getByRole('button', { name: 'Menüyü aç' }))

    const sidebar = screen.getByRole('dialog', { name: 'BereCat' })
    const links = within(sidebar).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(within(sidebar).getByRole('link', { name: 'Anasayfa' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(within(sidebar).getByRole('link', { name: 'Arşiv' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('session bulunmadığında arşiv endpointlerine gitmeden login ekranına yönlendirir', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: null }))

    renderArchive()

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    expect(callsFor('/api/archive/work-items')).toHaveLength(0)
    expect(callsFor('/api/archive/suggestions')).toHaveLength(0)
  })

  it('boş arşiv ile filtrelenmiş boş sonucu doğru güvenli metinlerle ayırır', async () => {
    installDefaultFetch(() => jsonResponse(archiveResponse([])))
    renderArchive()

    expect(
      await screen.findByText('Arşivde kayıt bulunamadı.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Birim'), {
      target: { value: 'digital' },
    })

    expect(
      await screen.findByText('Arama kriterlerine uygun kayıt bulunamadı.'),
    ).toBeInTheDocument()
    await waitFor(() => {
      const call = callsFor('/api/archive/work-items').at(-1)
      expect(requestUrl(call?.[0] ?? '')).toContain('moduleKey=digital')
    })
  })

  it('arama ve tarih filtrelerini API sınırlarıyla kısıtlar', async () => {
    installDefaultFetch()
    renderArchive()

    await screen.findByText('Viabor Boron Complex')
    const searchInput = screen.getByPlaceholderText(
      'Firma, ürün veya sipariş kodu ara',
    )
    const completedFromInput = screen.getByLabelText('Başlangıç Tarihi')
    const completedToInput = screen.getByLabelText('Bitiş Tarihi')

    expect(searchInput).toHaveAttribute('maxlength', '200')
    expect(completedFromInput).not.toHaveAttribute('max')
    expect(completedToInput).not.toHaveAttribute('min')

    fireEvent.change(completedToInput, {
      target: { value: '2026-09-30' },
    })
    expect(completedFromInput).toHaveAttribute('max', '2026-09-30')

    fireEvent.change(completedFromInput, {
      target: { value: '2026-09-01' },
    })
    expect(completedToInput).toHaveAttribute('min', '2026-09-01')

    await waitFor(() => {
      const call = callsFor('/api/archive/work-items').at(-1)
      const url = new URL(requestUrl(call?.[0] ?? ''), 'http://localhost')
      expect(url.searchParams.get('completedFrom')).toBe('2026-09-01')
      expect(url.searchParams.get('completedTo')).toBe('2026-09-30')
    })
    const validRequestCount = callsFor('/api/archive/work-items').length

    fireEvent.change(completedFromInput, {
      target: { value: '2026-10-01' },
    })
    fireEvent.change(completedToInput, {
      target: { value: '2026-08-31' },
    })

    expect(completedFromInput).toHaveValue('2026-09-01')
    expect(completedToInput).toHaveValue('2026-09-30')
    expect(callsFor('/api/archive/work-items')).toHaveLength(validRequestCount)
  })

  it('birim, tamamlayan ve tarih filtrelerini birlikte gönderip sayfayı bire döndürür', async () => {
    installDefaultFetch((url) => {
      const requestedPage = Number(url.searchParams.get('page') ?? '1')
      return jsonResponse(
        archiveResponse([archivedItem], {
          page: requestedPage,
          total: 50,
          totalPages: 2,
        }),
      )
    })
    renderArchive()

    await screen.findByText('Viabor Boron Complex')
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }))

    await waitFor(() => {
      const pageTwoCall = callsFor('/api/archive/work-items').at(-1)
      expect(requestUrl(pageTwoCall?.[0] ?? '')).toContain('page=2')
    })

    fireEvent.change(screen.getByLabelText('Birim'), {
      target: { value: 'team-approval' },
    })
    fireEvent.change(screen.getByLabelText('Tamamlayan'), {
      target: { value: secondUser.id },
    })
    fireEvent.change(screen.getByLabelText('Başlangıç Tarihi'), {
      target: { value: '2026-09-01' },
    })
    fireEvent.change(screen.getByLabelText('Bitiş Tarihi'), {
      target: { value: '2026-09-30' },
    })

    await waitFor(() => {
      const call = callsFor('/api/archive/work-items').at(-1)
      const url = new URL(requestUrl(call?.[0] ?? ''), 'http://localhost')
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.get('moduleKey')).toBe('team-approval')
      expect(url.searchParams.get('completedBy')).toBe(secondUser.id)
      expect(url.searchParams.get('completedFrom')).toBe('2026-09-01')
      expect(url.searchParams.get('completedTo')).toBe('2026-09-30')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Filtreleri Temizle' }))
    expect(screen.getByLabelText('Birim')).toHaveValue('')
    expect(screen.getByLabelText('Tamamlayan')).toHaveValue('')
    expect(screen.getByLabelText('Başlangıç Tarihi')).toHaveValue('')
    expect(screen.getByLabelText('Bitiş Tarihi')).toHaveValue('')
  })

  it('arama önerilerini iki karakterden sonra debounce ile getirir, tekilleştirir ve seçimi uygular', async () => {
    const duplicateSuggestions: ArchiveSuggestion[] = [
      { type: 'company', value: 'Acme İlaç' },
      { type: 'company', value: 'Acme İlaç' },
      { type: 'product', value: 'Acme Vitamin' },
    ]
    installDefaultFetch(
      () => jsonResponse(archiveResponse()),
      () => jsonResponse({ suggestions: duplicateSuggestions }),
    )
    renderArchive()

    await screen.findByText('Viabor Boron Complex')
    const searchInput = screen.getByPlaceholderText(
      'Firma, ürün veya sipariş kodu ara',
    )

    fireEvent.change(searchInput, { target: { value: 'A' } })
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    expect(callsFor('/api/archive/suggestions')).toHaveLength(0)

    fireEvent.change(searchInput, { target: { value: 'Ac' } })
    const suggestions = await screen.findByRole('listbox', {
      name: 'Arama önerileri',
    })
    expect(within(suggestions).getAllByRole('option')).toHaveLength(2)
    expect(callsFor('/api/archive/suggestions').at(0)?.[1]).toEqual(
      expect.objectContaining({ credentials: 'include' }),
    )

    fireEvent.click(within(suggestions).getByText('Acme İlaç'))
    expect(searchInput).toHaveValue('Acme İlaç')

    await waitFor(() => {
      const calls = callsFor('/api/archive/work-items')
      expect(
        calls.some(([input]) =>
          new URL(requestUrl(input), 'http://localhost').searchParams.has(
            'q',
            'Acme İlaç',
          ),
        ),
      ).toBe(true)
    })
  })

  it('serbest aramayı Enter ile uygular, Escape ile önerileri kapatır ve eski öneri isteğini iptal eder', async () => {
    let firstSuggestionSignal: AbortSignal | undefined
    installDefaultFetch(
      () => jsonResponse(archiveResponse()),
      (url, init) => {
        if (url.searchParams.get('q') === 'Ac') {
          firstSuggestionSignal = init?.signal ?? undefined

          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('İptal edildi.', 'AbortError'))
            })
          })
        }

        return jsonResponse({
          suggestions: [{ type: 'product', value: 'Acme Vitamin' }],
        })
      },
    )
    renderArchive()

    await screen.findByText('Viabor Boron Complex')
    const searchInput = screen.getByPlaceholderText(
      'Firma, ürün veya sipariş kodu ara',
    )
    fireEvent.change(searchInput, { target: { value: 'Ac' } })

    await waitFor(() => {
      expect(firstSuggestionSignal).toBeDefined()
    })

    fireEvent.change(searchInput, { target: { value: 'Acm' } })
    await waitFor(() => {
      expect(firstSuggestionSignal?.aborted).toBe(true)
    })

    expect(
      await screen.findByRole('listbox', { name: 'Arama önerileri' }),
    ).toBeInTheDocument()
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(
      screen.queryByRole('listbox', { name: 'Arama önerileri' }),
    ).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'serbest metin' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(
        callsFor('/api/archive/work-items').some(([input]) =>
          new URL(requestUrl(input), 'http://localhost').searchParams.has(
            'q',
            'serbest metin',
          ),
        ),
      ).toBe(true)
    })
  })

  it('pending öneri isteğini Escape ile kapatınca yükleme durumunu temizler', async () => {
    let suggestionSignal: AbortSignal | undefined
    installDefaultFetch(
      () => jsonResponse(archiveResponse()),
      (_url, init) => {
        suggestionSignal = init?.signal ?? undefined

        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('İptal edildi.', 'AbortError'))
          })
        })
      },
    )
    renderArchive()

    await screen.findByText('Viabor Boron Complex')
    const searchInput = screen.getByPlaceholderText(
      'Firma, ürün veya sipariş kodu ara',
    )
    fireEvent.change(searchInput, { target: { value: 'Ac' } })

    expect(await screen.findByText('Öneriler aranıyor…')).toBeInTheDocument()
    fireEvent.keyDown(searchInput, { key: 'Escape' })

    await waitFor(() => {
      expect(suggestionSignal?.aborted).toBe(true)
      expect(screen.queryByText('Öneriler aranıyor…')).not.toBeInTheDocument()
    })
  })

  it('genel yükleme hatasında güvenli mesaj gösterir ve Tekrar Dene çalışır', async () => {
    let archiveCallCount = 0
    installDefaultFetch(() => {
      archiveCallCount += 1
      return archiveCallCount === 1
        ? jsonResponse({}, 500)
        : jsonResponse(archiveResponse())
    })
    renderArchive()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Arşiv verileri yüklenemedi.')
    fireEvent.click(within(alert).getByRole('button', { name: 'Tekrar Dene' }))

    expect(await screen.findByText('Viabor Boron Complex')).toBeInTheDocument()
    expect(archiveCallCount).toBe(2)
  })

  it('Görüntüle bağlantısını sunar ve Yeniden Aç sonrası satırı kaldırıp sayacı günceller', async () => {
    let archiveCallCount = 0
    installDefaultFetch(() => {
      archiveCallCount += 1
      return jsonResponse(
        archiveCallCount === 1 ? archiveResponse() : archiveResponse([]),
      )
    })
    renderArchive()

    expect(
      await screen.findByRole('link', {
        name: 'Viabor Boron Complex işini görüntüle',
      }),
    ).toHaveAttribute('href', `/isler/${archivedItem.id}`)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Viabor Boron Complex işini yeniden aç',
      }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('link', {
          name: 'Viabor Boron Complex işini görüntüle',
        }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Arşivde kayıt bulunamadı.')).toBeInTheDocument()
    expect(screen.getByText(/Toplam/).closest('p')).toHaveTextContent('Toplam 0 kayıt')

    const reopenCall = callsFor(`/api/work-items/${archivedItem.id}/reopen`).at(0)
    expect(reopenCall?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('Yeniden Aç hatasında ham API mesajını göstermeyip arşiv satırını korur', async () => {
    installDefaultFetch(
      () => jsonResponse(archiveResponse()),
      () => jsonResponse({ suggestions: [] }),
      () => jsonResponse({ message: 'private database detail' }, 500),
    )
    renderArchive()

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Viabor Boron Complex işini yeniden aç',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'İş yeniden açılamadı.',
    )
    expect(screen.queryByText('private database detail')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Viabor Boron Complex işini görüntüle',
      }),
    ).toBeInTheDocument()
  })

  it('archive isteği 401 döndüğünde mevcut auth oturumunu geçersizleştirip login ekranına gider', async () => {
    installDefaultFetch(() => jsonResponse({}, 401))
    renderArchive()

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Tamamlanan İşler')).not.toBeInTheDocument()
  })
})
