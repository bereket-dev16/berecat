import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMasterDataSuggestions } from './master-data-api'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validSuggestion(value = 'Örnek Firma') {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    kind: 'company',
    value,
  } as const
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('master data öneri API istemcisi', () => {
  it('kind, sorgu, limit ve bağlamı güvenli query parametreleriyle gönderir', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        suggestions: [
          { ...validSuggestion('Ürün A'), kind: 'product' },
        ],
      }),
    )

    await getMasterDataSuggestions({
      kind: 'product',
      q: '  Ürün  ',
      limit: 12,
      company: '  Firma A  ',
      product: '  Bağlam Ürünü  ',
      packagingType: '  Kutu  ',
    })

    const [input, init] = fetchMock.mock.calls[0]
    const url = new URL(String(input), 'http://localhost')
    expect(url.pathname).toBe('/api/master-data/suggestions')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      kind: 'product',
      limit: '12',
      q: 'Ürün',
      company: 'Firma A',
      product: 'Bağlam Ürünü',
      packagingType: 'Kutu',
    })
    expect(init).toEqual(
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('boş sorgu ve boş bağlam değerlerini URL içine koymaz', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ suggestions: [] }))

    await getMasterDataSuggestions({
      kind: 'company',
      q: '   ',
      company: ' ',
    })

    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(url.searchParams.get('kind')).toBe('company')
    expect(url.searchParams.get('limit')).toBe('10')
    expect(url.searchParams.has('q')).toBe(false)
    expect(url.searchParams.has('company')).toBe(false)
  })

  it('sorguyu Unicode code point hesabıyla 100 karakterde sınırlar', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ suggestions: [] }))

    await getMasterDataSuggestions({ kind: 'company', q: '😀'.repeat(120) })

    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(Array.from(url.searchParams.get('q') ?? '')).toHaveLength(100)
  })

  it('limit değerini 1 ile 20 arasında sınırlar', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ suggestions: [] })),
    )

    await getMasterDataSuggestions({ kind: 'company', limit: 99 })
    await getMasterDataSuggestions({ kind: 'company', limit: 0 })

    expect(
      new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost').searchParams.get(
        'limit',
      ),
    ).toBe('20')
    expect(
      new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost').searchParams.get(
        'limit',
      ),
    ).toBe('1')
  })

  it('doğrulanmış öneri listesini döndürür', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ suggestions: [validSuggestion()] }),
    )

    await expect(
      getMasterDataSuggestions({ kind: 'company' }),
    ).resolves.toEqual([validSuggestion()])
  })

  it('istenen kind ile uyuşmayan veya bozuk response gövdesini reddeder', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        suggestions: [{ ...validSuggestion(), kind: 'supplier' }],
      }),
    )

    await expect(
      getMasterDataSuggestions({ kind: 'company' }),
    ).rejects.toMatchObject({ name: 'MasterDataRequestError', kind: 'error' })
  })

  it('401 ve 400 yanıtlarını güvenli hata türlerine dönüştürür', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'gizli ayrıntı' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'gizli ayrıntı' }, 400))

    await expect(
      getMasterDataSuggestions({ kind: 'company' }),
    ).rejects.toMatchObject({
      name: 'MasterDataRequestError',
      kind: 'unauthorized',
    })
    await expect(
      getMasterDataSuggestions({ kind: 'company' }),
    ).rejects.toMatchObject({
      name: 'MasterDataRequestError',
      kind: 'validation',
    })
  })

  it('network hatasını güvenli hata yapar, iptal hatasını ise aynen korur', async () => {
    fetchMock.mockRejectedValueOnce(new Error('özel ağ ayrıntısı'))

    await expect(
      getMasterDataSuggestions({ kind: 'company' }),
    ).rejects.toMatchObject({ name: 'MasterDataRequestError', kind: 'error' })

    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('İptal edildi.', 'AbortError')
    fetchMock.mockRejectedValueOnce(abortError)

    await expect(
      getMasterDataSuggestions({ kind: 'company' }, controller.signal),
    ).rejects.toBe(abortError)
  })
})
