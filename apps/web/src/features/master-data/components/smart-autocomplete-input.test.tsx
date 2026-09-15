import * as Dialog from '@radix-ui/react-dialog'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MasterDataSuggestion } from '../master-data-types'
import { SmartAutocompleteInput } from './smart-autocomplete-input'

const apiMocks = vi.hoisted(() => ({
  getSuggestions: vi.fn(),
}))

vi.mock('../master-data-api', () => ({
  getMasterDataSuggestions: apiMocks.getSuggestions,
  isMasterDataRequestError: (error: unknown, kind: string) =>
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    error.kind === kind,
}))

const companySuggestions: MasterDataSuggestion[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    kind: 'company',
    value: 'Örnek Firma',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    kind: 'company',
    value: 'İkinci Firma',
  },
]

interface HarnessProps {
  initialValue?: string
  disabled?: boolean
  required?: boolean
  maxLength?: number
  onUnauthorized?: () => void
  onSubmit?: () => void
}

function renderHarness({
  initialValue = '',
  disabled = false,
  required = false,
  maxLength = 200,
  onUnauthorized = vi.fn(),
  onSubmit = vi.fn(),
}: HarnessProps = {}) {
  const observedValues: string[] = []

  function Harness() {
    const [value, setValue] = useState(initialValue)

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <SmartAutocompleteInput
          label="Firma İsmi"
          name="companyName"
          kind="company"
          value={value}
          onChange={(nextValue) => {
            observedValues.push(nextValue)
            setValue(nextValue)
          }}
          onUnauthorized={onUnauthorized}
          context={{
            company: 'Bağlam Firma',
            product: 'Bağlam Ürün',
            packagingType: 'Kutu',
          }}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
        />
      </form>
    )
  }

  render(<Harness />)

  return {
    input: screen.getByRole('combobox', { name: 'Firma İsmi' }),
    observedValues,
  }
}

async function focusAndWaitForRequest(input: HTMLElement) {
  fireEvent.focus(input)
  await waitFor(() => expect(apiMocks.getSuggestions).toHaveBeenCalled())
}

beforeEach(() => {
  apiMocks.getSuggestions.mockReset()
  apiMocks.getSuggestions.mockResolvedValue(companySuggestions)
})

afterEach(() => {
  cleanup()
})

describe('SmartAutocompleteInput', () => {
  it('serbest metni controlled state üzerinden değiştirmeye izin verir', () => {
    const { input, observedValues } = renderHarness()

    fireEvent.change(input, { target: { value: 'Yeni Serbest Firma' } })

    expect(input).toHaveValue('Yeni Serbest Firma')
    expect(observedValues).toEqual(['Yeni Serbest Firma'])
  })

  it('focus olduğunda boş sorguyla en sık kullanılan önerileri ister', async () => {
    const { input } = renderHarness()

    await focusAndWaitForRequest(input)

    expect(apiMocks.getSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'company', q: '', limit: 20 }),
      expect.any(AbortSignal),
    )
  })

  it('250 ms debounce sonrasında sorgu ve bağlam alanlarını gönderir', async () => {
    const { input } = renderHarness()

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Ör' } })

    expect(apiMocks.getSuggestions).not.toHaveBeenCalled()
    await waitFor(() => expect(apiMocks.getSuggestions).toHaveBeenCalledTimes(1))
    expect(apiMocks.getSuggestions).toHaveBeenCalledWith(
      {
        kind: 'company',
        q: 'Ör',
        limit: 20,
        company: 'Bağlam Firma',
        product: 'Bağlam Ürün',
        packagingType: 'Kutu',
      },
      expect.any(AbortSignal),
    )
  })

  it('değer değişince önceki bekleyen isteğin AbortSignal değerini iptal eder', async () => {
    apiMocks.getSuggestions.mockImplementation(
      () => new Promise<MasterDataSuggestion[]>(() => undefined),
    )
    const { input } = renderHarness()

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Ör' } })
    await waitFor(() => expect(apiMocks.getSuggestions).toHaveBeenCalledTimes(1))
    const firstSignal = apiMocks.getSuggestions.mock.calls[0][1] as AbortSignal

    fireEvent.change(input, { target: { value: 'Örn' } })

    expect(firstSignal.aborted).toBe(true)
    await waitFor(() => expect(apiMocks.getSuggestions).toHaveBeenCalledTimes(2))
  })

  it('öneriyi fareyle seçince görünen değeri aynen forma taşır', async () => {
    const { input, observedValues } = renderHarness()
    await focusAndWaitForRequest(input)

    fireEvent.click(
      await screen.findByRole('option', { name: 'Örnek Firma' }),
    )

    expect(input).toHaveValue('Örnek Firma')
    expect(observedValues.at(-1)).toBe('Örnek Firma')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('ArrowDown ve Enter ile aktif öneriyi seçer', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Örnek Firma')
  })

  it('panel açıkken aktif öneri yoksa Enter formu göndermez ve serbest değeri korur', async () => {
    const onSubmit = vi.fn()
    const { input, observedValues } = renderHarness({
      initialValue: 'Serbest Firma',
      onSubmit,
    })
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })

    expect(input).not.toHaveAttribute('aria-activedescendant')
    const eventAllowed = fireEvent.keyDown(input, { key: 'Enter' })

    expect(eventAllowed).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(input).toHaveValue('Serbest Firma')
    expect(observedValues).toEqual([])
  })

  it('debounce tamamlanmadan Enter formu göndermez ve yazılan değeri korur', () => {
    const onSubmit = vi.fn()
    const { input, observedValues } = renderHarness({ onSubmit })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Bekleyen Serbest Değer' } })
    const eventAllowed = fireEvent.keyDown(input, { key: 'Enter' })

    expect(eventAllowed).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
    expect(input).toHaveValue('Bekleyen Serbest Değer')
    expect(observedValues).toEqual(['Bekleyen Serbest Değer'])
    expect(apiMocks.getSuggestions).not.toHaveBeenCalled()
  })

  it('ArrowUp ilk kullanımda son öneriye sarar', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })

    fireEvent.keyDown(input, { key: 'ArrowUp' })

    expect(
      screen.getByRole('option', { name: 'İkinci Firma' }),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowDown son öneriden ilk öneriye sarar', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    expect(
      screen.getByRole('option', { name: 'Örnek Firma' }),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('klavye ile seçilen alt sıradaki öneriyi görünür alana kaydırır', async () => {
    apiMocks.getSuggestions.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        kind: 'company' as const,
        value: `Firma ${index + 1}`,
      })),
    )
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    const options = await screen.findAllByRole('option')
    const lastOption = options.at(-1)
    const scrollIntoView = vi.fn()

    expect(lastOption).toBeDefined()
    Object.defineProperty(lastOption as HTMLElement, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    for (let index = 0; index < 10; index += 1) {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    }

    expect(lastOption).toHaveAttribute('aria-selected', 'true')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('Escape önerileri kapatır, serbest metni korur ve isteği iptal eder', async () => {
    apiMocks.getSuggestions.mockImplementation(
      () => new Promise<MasterDataSuggestion[]>(() => undefined),
    )
    const { input } = renderHarness({ initialValue: 'Korunan Değer' })
    await focusAndWaitForRequest(input)
    const signal = apiMocks.getSuggestions.mock.calls[0][1] as AbortSignal
    expect(await screen.findByText('Öneriler yükleniyor…')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(input).toHaveValue('Korunan Değer')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(signal.aborted).toBe(true)
  })

  it('Tab önerileri kapatırken tarayıcının odak hareketini engellemez', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })

    const eventAllowed = fireEvent.keyDown(input, { key: 'Tab' })

    expect(eventAllowed).toBe(true)
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('öneri paneli veya scrollbar kaynaklı pointer blur etkileşiminde paneli açık tutar', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    const listbox = await screen.findByRole('listbox', {
      name: 'Firma İsmi önerileri',
    })
    const panel = listbox.parentElement

    expect(panel).not.toBeNull()
    fireEvent.pointerDown(panel as HTMLElement)
    fireEvent.blur(input)

    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(listbox).toBeInTheDocument()

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    fireEvent.blur(input)

    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('modal içinde mouse wheel olayını engellemeden öneri panelini açık tutar', async () => {
    apiMocks.getSuggestions.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({
        id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        kind: 'company' as const,
        value: `Firma ${index + 1}`,
      })),
    )

    function ModalHarness() {
      const [value, setValue] = useState('')

      return (
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content>
              <Dialog.Title>İş Formu</Dialog.Title>
              <Dialog.Description>İş bilgilerini girin.</Dialog.Description>
              <SmartAutocompleteInput
                label="Firma İsmi"
                name="companyName"
                kind="company"
                value={value}
                onChange={setValue}
                onUnauthorized={vi.fn()}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )
    }

    render(<ModalHarness />)
    const input = screen.getByRole('combobox', { name: 'Firma İsmi' })
    await focusAndWaitForRequest(input)
    const listbox = await screen.findByRole('listbox', {
      name: 'Firma İsmi önerileri',
    })
    const options = await screen.findAllByRole('option')
    const panel = listbox.parentElement

    expect(options).toHaveLength(20)
    expect(panel).not.toBeNull()

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    })
    const eventAllowed = fireEvent(panel as HTMLElement, wheelEvent)

    expect(eventAllowed).toBe(true)
    expect(wheelEvent.defaultPrevented).toBe(false)
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('öneri panelinin dışındaki pointer etkileşiminde paneli kapatır', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    fireEvent.pointerDown(document.body, { button: 0 })
    fireEvent.click(document.body)

    await waitFor(() =>
      expect(input).toHaveAttribute('aria-expanded', 'false'),
    )
  })

  it('panel açıkken inputa yeniden tıklayıp öneri aramasına devam eder', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    fireEvent.pointerDown(input, { button: 0 })
    fireEvent.click(input)

    expect(input).toHaveAttribute('aria-expanded', 'true')

    fireEvent.change(input, { target: { value: 'Yeni Arama' } })

    await waitFor(() => expect(apiMocks.getSuggestions).toHaveBeenCalledTimes(2))
    expect(apiMocks.getSuggestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'Yeni Arama' }),
      expect.any(AbortSignal),
    )
  })

  it('combobox, listbox, option ve aktif descendant bağlarını kurar', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    const listbox = await screen.findByRole('listbox', {
      name: 'Firma İsmi önerileri',
    })

    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const activeOption = screen.getByRole('option', { name: 'Örnek Firma' })
    expect(input).toHaveAttribute('aria-activedescendant', activeOption.id)
  })

  it('istek sonuçlanana kadar Türkçe loading durumu gösterir', async () => {
    apiMocks.getSuggestions.mockImplementation(
      () => new Promise<MasterDataSuggestion[]>(() => undefined),
    )
    const { input } = renderHarness()

    await focusAndWaitForRequest(input)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Öneriler yükleniyor…',
    )
  })

  it('değer değiştiği anda eski önerileri debounce ve loading boyunca seçilemez kılar', async () => {
    apiMocks.getSuggestions
      .mockResolvedValueOnce(companySuggestions)
      .mockImplementationOnce(
        () => new Promise<MasterDataSuggestion[]>(() => undefined),
      )
    const { input } = renderHarness({ initialValue: 'Ör' })
    await focusAndWaitForRequest(input)
    await screen.findByRole('option', { name: 'Örnek Firma' })

    fireEvent.change(input, { target: { value: 'Güncel Firma' } })

    expect(
      screen.queryByRole('option', { name: 'Örnek Firma' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await waitFor(() => expect(apiMocks.getSuggestions).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Öneriler yükleniyor…')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Güncel Firma')
    expect(
      screen.queryByRole('option', { name: 'Örnek Firma' }),
    ).not.toBeInTheDocument()
  })

  it('bağlam değiştiği anda önceki bağlamın önerilerini geçersizleştirir', async () => {
    apiMocks.getSuggestions
      .mockResolvedValueOnce(companySuggestions)
      .mockImplementationOnce(
        () => new Promise<MasterDataSuggestion[]>(() => undefined),
      )
    const onUnauthorized = vi.fn()

    function ContextHarness() {
      const [company, setCompany] = useState('İlk Bağlam')
      const [value, setValue] = useState('Korunan Firma')

      return (
        <>
          <button type="button" onClick={() => setCompany('Yeni Bağlam')}>
            Bağlamı Değiştir
          </button>
          <SmartAutocompleteInput
            label="Firma İsmi"
            name="companyName"
            kind="company"
            value={value}
            onChange={setValue}
            onUnauthorized={onUnauthorized}
            context={{ company }}
          />
        </>
      )
    }

    render(<ContextHarness />)
    const input = screen.getByRole('combobox', { name: 'Firma İsmi' })
    await focusAndWaitForRequest(input)
    await screen.findByRole('option', { name: 'Örnek Firma' })

    fireEvent.click(screen.getByRole('button', { name: 'Bağlamı Değiştir' }))

    expect(
      screen.queryByRole('option', { name: 'Örnek Firma' }),
    ).not.toBeInTheDocument()
    await waitFor(() => expect(apiMocks.getSuggestions).toHaveBeenCalledTimes(2))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Korunan Firma')
    expect(
      screen.queryByRole('option', { name: 'Örnek Firma' }),
    ).not.toBeInTheDocument()
  })

  it('eşleşme yoksa değerin yeni değer olarak kullanılacağını bildirir', async () => {
    apiMocks.getSuggestions.mockResolvedValue([])
    const { input } = renderHarness({ initialValue: 'Yeni Firma' })

    await focusAndWaitForRequest(input)

    expect(
      await screen.findByText('“Yeni Firma” yeni değer olarak kullanılacak.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['BIOCARE', 'BİOCARE'],
    ['ＡＢＣ İLAÇ', 'ABC ilac'],
    ['KUTU / ETİKET', 'kutu/etiket'],
    ['ŞİRİN   ÇÖZÜM', 'sirin cozum'],
    ['Café', 'CAFE'],
  ])(
    '%j ile %j değerlerini backend normalizasyonuyla aynı kabul eder',
    async (initialValue, suggestionValue) => {
      apiMocks.getSuggestions.mockResolvedValue([
        {
          id: '10000000-0000-4000-8000-000000000003',
          kind: 'company',
          value: suggestionValue,
        },
      ])
      const { input } = renderHarness({ initialValue })

      await focusAndWaitForRequest(input)
      await screen.findByRole('option', { name: suggestionValue })

      expect(
        screen.queryByText(/yeni değer olarak kullanılacak/),
      ).not.toBeInTheDocument()
    },
  )

  it.each([
    ['C+', 'C'],
    ['%10', '10'],
  ])(
    '%j ile %j değerlerini konservatif exact karşılaştırmada ayrı tutar',
    async (initialValue, suggestionValue) => {
      apiMocks.getSuggestions.mockResolvedValue([
        {
          id: '10000000-0000-4000-8000-000000000004',
          kind: 'company',
          value: suggestionValue,
        },
      ])
      const { input } = renderHarness({ initialValue })

      await focusAndWaitForRequest(input)
      await screen.findByRole('option', { name: suggestionValue })

      expect(
        screen.getByText(`“${initialValue}” yeni değer olarak kullanılacak.`),
      ).toBeInTheDocument()
    },
  )

  it('öneri hatasında ham hatayı göstermeden free-text fallback sunar', async () => {
    apiMocks.getSuggestions.mockRejectedValue(
      new Error('özel sunucu ayrıntısı'),
    )
    const { input } = renderHarness({ initialValue: 'Korunan Firma' })

    await focusAndWaitForRequest(input)

    expect(
      await screen.findByText(
        'Öneriler yüklenemedi. Girdiğiniz değeri kullanabilirsiniz.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('özel sunucu ayrıntısı')).not.toBeInTheDocument()
    expect(input).toHaveValue('Korunan Firma')
  })

  it('401 öneri hatasında session callbackini çağırıp paneli kapatır', async () => {
    const onUnauthorized = vi.fn()
    apiMocks.getSuggestions.mockRejectedValue({ kind: 'unauthorized' })
    const { input } = renderHarness({ onUnauthorized })

    await focusAndWaitForRequest(input)

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('disabled durumda istek göndermez ve yazmayı engeller', async () => {
    const { input } = renderHarness({ disabled: true })

    fireEvent.focus(input)
    await new Promise((resolve) => window.setTimeout(resolve, 300))

    expect(input).toBeDisabled()
    expect(input).toHaveValue('')
    expect(apiMocks.getSuggestions).not.toHaveBeenCalled()
  })

  it('name, required ve maxLength form niteliklerini input üzerinde korur', () => {
    const { input } = renderHarness({ required: true, maxLength: 37 })

    expect(input).toHaveAttribute('name', 'companyName')
    expect(input).toHaveAttribute('required')
    expect(input).toHaveAttribute('maxlength', '37')
  })

  it('seçilen öneri değerine geçerken gereksiz ikinci öneri isteği başlatmaz', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)

    fireEvent.click(
      await screen.findByRole('option', { name: 'Örnek Firma' }),
    )
    await new Promise((resolve) => window.setTimeout(resolve, 300))

    expect(apiMocks.getSuggestions).toHaveBeenCalledTimes(1)
  })

  it('blur olduğunda öneri panelini kapatır', async () => {
    const { input } = renderHarness()
    await focusAndWaitForRequest(input)
    await screen.findByRole('listbox', { name: 'Firma İsmi önerileri' })

    fireEvent.blur(input)

    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
})
