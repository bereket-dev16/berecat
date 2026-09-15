import {
  Archive,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Search,
  Undo2,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import {
  isWorkItemRequestError,
  reopenWorkItem,
} from '../work-items/work-item-api'
import { useUserOptions } from '../work-items/use-user-options'
import {
  WORK_ITEM_MODULES,
  isWorkItemModuleKey,
} from '../work-items/work-item-constants'
import {
  getArchiveSuggestions,
  isArchiveRequestError,
} from './archive-api'
import type {
  ArchiveFilters,
  ArchiveSuggestion,
  ArchiveWorkItem,
} from './archive-types'
import { useArchiveWorkItems } from './use-archive-work-items'

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

const completedAtFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

interface ArchivePageContentProps {
  onUnauthorized: () => void
}

function formatCompletedAt(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '—' : completedAtFormatter.format(date)
}

function displayValue(value: string | null): string {
  return value?.trim() || '—'
}

function suggestionTypeLabel(type: ArchiveSuggestion['type']): string {
  if (type === 'company') {
    return 'Firma'
  }

  if (type === 'product') {
    return 'Ürün'
  }

  return 'Sipariş kodu'
}

export function ArchivePageContent({
  onUnauthorized,
}: ArchivePageContentProps) {
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [moduleKey, setModuleKey] = useState<ArchiveFilters['moduleKey']>('')
  const [completedBy, setCompletedBy] = useState('')
  const [completedFrom, setCompletedFrom] = useState('')
  const [completedTo, setCompletedTo] = useState('')
  const [page, setPage] = useState(1)
  const [suggestions, setSuggestions] = useState<ArchiveSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [reopeningId, setReopeningId] = useState<string | null>(null)
  const [reopenError, setReopenError] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const reopeningIdRef = useRef<string | null>(null)
  const userOptions = useUserOptions(true)

  const filters = useMemo<ArchiveFilters>(
    () => ({
      q: searchQuery,
      moduleKey,
      completedBy,
      completedFrom,
      completedTo,
      page,
      pageSize: PAGE_SIZE,
    }),
    [completedBy, completedFrom, completedTo, moduleKey, page, searchQuery],
  )
  const archive = useArchiveWorkItems(filters)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const query = searchInput.trim()

    if (!suggestionsEnabled || Array.from(query).length < 2) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSuggestionsLoading(true)

      void getArchiveSuggestions(query, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setSuggestions(result)
            setSuggestionsOpen(true)
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return
          }

          setSuggestions([])

          if (isArchiveRequestError(error, 'unauthorized')) {
            onUnauthorized()
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSuggestionsLoading(false)
          }
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [onUnauthorized, searchInput, suggestionsEnabled])

  useEffect(() => {
    function handleOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !searchContainerRef.current?.contains(event.target)
      ) {
        setSuggestionsOpen(false)
        setSuggestionsEnabled(false)
        setSuggestionsLoading(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [])

  useEffect(() => {
    if (
      archive.status === 'unauthorized' ||
      userOptions.status === 'unauthorized'
    ) {
      onUnauthorized()
    }
  }, [archive.status, onUnauthorized, userOptions.status])

  const hasActiveCriteria = Boolean(
    searchQuery || moduleKey || completedBy || completedFrom || completedTo,
  )

  const commitSearch = useCallback((value: string) => {
    const nextQuery = value.trim()
    setSearchInput(value)
    setSearchQuery(nextQuery)
    setPage(1)
    setSuggestions([])
    setSuggestionsOpen(false)
    setSuggestionsEnabled(false)
    setSuggestionsLoading(false)
  }, [])

  function clearFilters() {
    setSearchInput('')
    setSearchQuery('')
    setModuleKey('')
    setCompletedBy('')
    setCompletedFrom('')
    setCompletedTo('')
    setSuggestions([])
    setSuggestionsOpen(false)
    setSuggestionsEnabled(false)
    setSuggestionsLoading(false)
    setPage(1)
  }

  async function handleReopen(item: ArchiveWorkItem) {
    if (reopeningIdRef.current) {
      return
    }

    reopeningIdRef.current = item.id
    setReopeningId(item.id)
    setReopenError(null)

    try {
      await reopenWorkItem(item.id)
      archive.removeItem(item.id)

      if (archive.items.length === 1 && page > 1) {
        setPage((currentPage) => Math.max(1, currentPage - 1))
      } else {
        archive.refresh()
      }
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setReopenError('İş yeniden açılamadı.')
    } finally {
      reopeningIdRef.current = null
      setReopeningId(null)
    }
  }

  return (
    <section className="min-w-0 px-3 py-5 sm:px-5 lg:px-7 lg:py-7">
      <div className="mx-auto max-w-[96rem]">
        <nav aria-label="Sayfa yolu">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-[var(--brand-gold)] outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Anasayfaya Dön
          </Link>
        </nav>

        <div className="mb-6 mt-4 flex flex-col gap-2 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[var(--brand-gold)]">
              İş geçmişi
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Tamamlanan İşler
            </h2>
          </div>

        </div>

        <div className="rounded-xl border border-white/8 bg-black/10 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end 2xl:grid-cols-[minmax(18rem,1.45fr)_repeat(4,minmax(9rem,0.7fr))_auto]">
            <div
              ref={searchContainerRef}
              className="relative sm:col-span-2 lg:col-span-3 2xl:col-span-1"
            >
              <label
                htmlFor="archive-search"
                className="mb-1.5 block text-xs font-semibold text-zinc-300"
              >
                Birleşik Arama
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="archive-search"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen && suggestions.length > 0}
                  aria-controls="archive-suggestions"
                  autoComplete="off"
                  maxLength={200}
                  value={searchInput}
                  placeholder="Firma, ürün veya sipariş kodu ara"
                  onChange={(event) => {
                    const value = event.target.value
                    setSearchInput(value)

                    if (Array.from(value.trim()).length < 2) {
                      setSuggestions([])
                      setSuggestionsLoading(false)
                      setSuggestionsOpen(false)
                      setSuggestionsEnabled(false)
                    } else {
                      setSuggestionsOpen(true)
                      setSuggestionsEnabled(true)
                    }
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setSuggestionsOpen(true)
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitSearch(searchInput)
                    }

                    if (event.key === 'Escape') {
                      setSuggestionsOpen(false)
                      setSuggestionsEnabled(false)
                      setSuggestionsLoading(false)
                    }
                  }}
                  className="min-h-11 w-full rounded-md border border-white/10 bg-[#1f221e] py-2 pl-9 pr-10 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)]"
                />
                {searchInput ? (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onClick={() => commitSearch('')}
                    className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-zinc-400 outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                ) : null}
              </div>

              {suggestionsOpen && suggestions.length > 0 ? (
                <ul
                  id="archive-suggestions"
                  role="listbox"
                  aria-label="Arama önerileri"
                  className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-[var(--brand-olive)] bg-[#252923] p-1.5 shadow-2xl"
                >
                  {suggestions.map((suggestion) => (
                    <li key={`${suggestion.type}-${suggestion.value}`} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => commitSearch(suggestion.value)}
                        className="flex min-h-10 w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm text-zinc-100 outline-none hover:bg-[var(--brand-olive)]/65 focus-visible:bg-[var(--brand-olive)]/65"
                      >
                        <span className="truncate">{suggestion.value}</span>
                        <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-500">
                          {suggestionTypeLabel(suggestion.type)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {suggestionsLoading ? (
                <span className="absolute right-2 top-full mt-2 text-[0.68rem] text-zinc-500">
                  Öneriler aranıyor…
                </span>
              ) : null}
            </div>

            <label className="block text-xs font-semibold text-zinc-300">
              Birim
              <select
                value={moduleKey}
                onChange={(event) => {
                  const value = event.target.value
                  setModuleKey(isWorkItemModuleKey(value) ? value : '')
                  setPage(1)
                }}
                className="mt-1.5 min-h-11 w-full rounded-md border border-white/10 bg-[#1f221e] px-3 text-sm text-zinc-100 outline-none focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)]"
              >
                <option value="">Tümü</option>
                {WORK_ITEM_MODULES.map((module) => (
                  <option key={module.key} value={module.key}>
                    {module.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-zinc-300">
              Tamamlayan
              <select
                value={completedBy}
                onChange={(event) => {
                  setCompletedBy(event.target.value)
                  setPage(1)
                }}
                disabled={userOptions.status === 'loading'}
                className="mt-1.5 min-h-11 w-full rounded-md border border-white/10 bg-[#1f221e] px-3 text-sm text-zinc-100 outline-none focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)] disabled:opacity-60"
              >
                <option value="">Tümü</option>
                {userOptions.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-zinc-300">
              Başlangıç Tarihi
              <input
                type="date"
                max={completedTo || undefined}
                value={completedFrom}
                onChange={(event) => {
                  const value = event.target.value

                  if (value && completedTo && value > completedTo) {
                    return
                  }

                  setCompletedFrom(value)
                  setPage(1)
                }}
                className="mt-1.5 min-h-11 w-full rounded-md border border-white/10 bg-[#1f221e] px-3 text-sm text-zinc-100 outline-none focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)]"
              />
            </label>

            <label className="block text-xs font-semibold text-zinc-300">
              Bitiş Tarihi
              <input
                type="date"
                min={completedFrom || undefined}
                value={completedTo}
                onChange={(event) => {
                  const value = event.target.value

                  if (value && completedFrom && value < completedFrom) {
                    return
                  }

                  setCompletedTo(value)
                  setPage(1)
                }}
                className="mt-1.5 min-h-11 w-full rounded-md border border-white/10 bg-[#1f221e] px-3 text-sm text-zinc-100 outline-none focus:border-[var(--brand-gold)] focus:ring-1 focus:ring-[var(--brand-gold)]"
              />
            </label>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveCriteria && !searchInput}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-zinc-200 outline-none hover:border-[var(--brand-orange)]/50 hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw aria-hidden="true" size={15} />
              Filtreleri Temizle
            </button>
          </div>

          {userOptions.status === 'error' ? (
            <div className="mt-3 flex items-center gap-3 text-xs text-[#ffad7d]">
              <span>Kullanıcı seçenekleri yüklenemedi.</span>
              <button
                type="button"
                onClick={userOptions.retry}
                className="font-semibold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
              >
                Tekrar Dene
              </button>
            </div>
          ) : null}
        </div>

        {reopenError ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/10 px-4 py-3 text-sm text-[#ffbd94]"
          >
            {reopenError}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-black/10">
          {archive.status === 'error' ? (
            <div
              role="alert"
              className="grid min-h-64 place-items-center px-5 py-10 text-center"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Arşiv verileri yüklenemedi.
                </p>
                <button
                  type="button"
                  onClick={archive.retry}
                  className="mt-5 min-h-11 rounded-md bg-[var(--brand-orange)] px-5 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#c75f1e] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                >
                  Tekrar Dene
                </button>
              </div>
            </div>
          ) : null}

          {archive.status === 'loading' ? <ArchiveTableLoading /> : null}

          {archive.status === 'success' && archive.items.length === 0 ? (
            <div className="grid min-h-64 place-items-center px-5 py-10 text-center">
              <div>
                <Archive
                  aria-hidden="true"
                  size={28}
                  className="mx-auto mb-3 text-[var(--brand-gold)]/75"
                />
                <p className="text-sm font-medium text-zinc-300">
                  {hasActiveCriteria
                    ? 'Arama kriterlerine uygun kayıt bulunamadı.'
                    : 'Arşivde kayıt bulunamadı.'}
                </p>
              </div>
            </div>
          ) : null}

          {archive.status === 'success' && archive.items.length > 0 ? (
            <ArchiveTable
              items={archive.items}
              reopeningId={reopeningId}
              onReopen={(item) => void handleReopen(item)}
            />
          ) : null}
        </div>

        {archive.status === 'success' ? (
          <nav
            aria-label="Arşiv sayfaları"
            className="mt-4 flex flex-col gap-3 rounded-lg border border-white/6 bg-black/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-zinc-400">
              Toplam{' '}
              <strong className="font-semibold text-zinc-100">
                {archive.pagination.total}
              </strong>{' '}
              kayıt · Sayfa {archive.pagination.page} /{' '}
              {Math.max(1, archive.pagination.totalPages)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/10 px-3 font-semibold text-zinc-200 outline-none hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Önceki
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={
                  archive.pagination.totalPages === 0 ||
                  page >= archive.pagination.totalPages
                }
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/10 px-3 font-semibold text-zinc-200 outline-none hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sonraki
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  )
}

interface ArchiveTableProps {
  items: ArchiveWorkItem[]
  reopeningId: string | null
  onReopen: (item: ArchiveWorkItem) => void
}

function ArchiveTable({ items, reopeningId, onReopen }: ArchiveTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[76rem] w-full border-collapse text-left text-sm">
        <caption className="sr-only">Tamamlanan işler arşivi</caption>
        <thead className="bg-[#20231f] text-[0.68rem] uppercase tracking-[0.12em] text-zinc-400">
          <tr>
            {[
              'Tamamlanma Tarihi',
              'Sipariş Kodu',
              'Firma',
              'Ürün',
              'Ambalaj Türü',
              'Sipariş Cinsi',
              'Sipariş Miktarı',
              'Son Birim',
              'Tamamlayan',
              'İşlemler',
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="border-b border-white/8 px-4 py-3 font-semibold"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6">
          {items.map((item) => {
            const isReopening = reopeningId === item.id

            return (
              <tr
                key={item.id}
                className="bg-transparent text-zinc-300 transition-colors hover:bg-[var(--brand-olive)]/18"
              >
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-zinc-400">
                  {formatCompletedAt(item.completedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[var(--brand-gold)]">
                  {displayValue(item.orderCode)}
                </td>
                <td className="max-w-52 truncate px-4 py-3.5 font-medium text-zinc-100">
                  {item.companyName}
                </td>
                <td className="max-w-52 truncate px-4 py-3.5">
                  {item.productName}
                </td>
                <td className="max-w-40 truncate px-4 py-3.5">
                  {displayValue(item.packagingType)}
                </td>
                <td className="max-w-40 truncate px-4 py-3.5">
                  {displayValue(item.orderType)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  {displayValue(item.orderedQuantity)}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className="rounded-full border border-[var(--brand-green)]/35 bg-[var(--brand-green)]/10 px-2 py-1 text-xs text-[#cde79d]">
                    {item.moduleTitle}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <span className="block font-medium text-zinc-100">
                    {item.completedBy.displayName}
                  </span>
                  <span className="text-xs text-zinc-500">
                    @{item.completedBy.username}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/isler/${encodeURIComponent(item.id)}`}
                      aria-label={`${item.productName} işini görüntüle`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-semibold text-zinc-200 outline-none hover:bg-white/6 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                    >
                      <Eye aria-hidden="true" size={15} />
                      Görüntüle
                    </Link>
                    <button
                      type="button"
                      aria-label={`${item.productName} işini yeniden aç`}
                      title="Yeniden Aç"
                      disabled={reopeningId !== null}
                      aria-busy={isReopening}
                      onClick={() => onReopen(item)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[var(--brand-orange)] px-2.5 text-xs font-semibold text-zinc-950 outline-none hover:bg-[#c75f1e] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-45"
                    >
                      <Undo2 aria-hidden="true" size={15} />
                      {isReopening ? 'Açılıyor…' : 'Yeniden Aç'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ArchiveTableLoading() {
  return (
    <div
      role="status"
      aria-label="Arşiv yükleniyor"
      className="overflow-hidden"
    >
      <span className="sr-only">Arşiv yükleniyor…</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="grid min-h-14 grid-cols-[1fr_0.8fr_1.4fr_1.2fr] items-center gap-5 border-b border-white/5 px-4 last:border-b-0"
        >
          {Array.from({ length: 4 }, (_, cellIndex) => (
            <span
              key={cellIndex}
              className="home-skeleton h-3 rounded-full"
              style={{ width: `${68 + ((index + cellIndex) % 3) * 11}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
