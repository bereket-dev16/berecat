import * as Popover from '@radix-ui/react-popover'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  getMasterDataSuggestions,
  isMasterDataRequestError,
} from '../master-data-api'
import type {
  MasterDataKind,
  MasterDataSuggestion,
  MasterDataSuggestionContext,
} from '../master-data-types'

const SUGGESTION_DEBOUNCE_MS = 250

const inputClassName =
  'mt-2 h-11 w-full rounded-md border border-white/12 bg-black/20 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/25 disabled:cursor-wait disabled:opacity-60'

type SuggestionStatus = 'idle' | 'loading' | 'success' | 'error'

interface SmartAutocompleteInputProps {
  label: string
  name: string
  kind: MasterDataKind
  value: string
  onChange: (value: string) => void
  onUnauthorized: () => void
  context?: MasterDataSuggestionContext
  disabled?: boolean
  required?: boolean
  maxLength?: number
  wide?: boolean
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function createComparisonKey(value: string): string {
  return collapseWhitespace(
    collapseWhitespace(value.normalize('NFKC'))
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıi]/gu, 'i')
      .replace(/ğ/gu, 'g')
      .replace(/ü/gu, 'u')
      .replace(/ş/gu, 's')
      .replace(/ö/gu, 'o')
      .replace(/ç/gu, 'c')
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .replace(/\s*([\p{P}\p{S}])\s*/gu, '$1'),
  )
}

function valuesMatch(left: string, right: string): boolean {
  return createComparisonKey(left) === createComparisonKey(right)
}

export function SmartAutocompleteInput({
  label,
  name,
  kind,
  value,
  onChange,
  onUnauthorized,
  context,
  disabled = false,
  required = false,
  maxLength,
  wide = false,
}: SmartAutocompleteInputProps) {
  const generatedId = useId()
  const inputId = `master-data-input-${generatedId}`
  const listboxId = `master-data-listbox-${generatedId}`
  const statusId = `master-data-status-${generatedId}`
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SuggestionStatus>('idle')
  const [suggestions, setSuggestions] = useState<MasterDataSuggestion[]>([])
  const [suggestionsRequestKey, setSuggestionsRequestKey] = useState<
    string | null
  >(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const requestVersionRef = useRef(0)
  const activeControllerRef = useRef<AbortController | null>(null)
  const selectedValueRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLLIElement | null>>([])
  const panelPointerInteractionRef = useRef(false)
  const panelPointerResetTimerRef = useRef<number | null>(null)
  const company = context?.company ?? ''
  const product = context?.product ?? ''
  const packagingType = context?.packagingType ?? ''
  const trimmedValue = value.trim()
  const requestKey = JSON.stringify([
    kind,
    value,
    company,
    product,
    packagingType,
  ])

  useEffect(() => {
    if (!focused || disabled) {
      return
    }

    if (selectedValueRef.current === value) {
      selectedValueRef.current = null
      return
    }

    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion
    const controller = new AbortController()
    activeControllerRef.current = controller
    const timeoutId = window.setTimeout(() => {
      setSuggestionsRequestKey(requestKey)
      setSuggestions([])
      setActiveIndex(-1)
      setStatus('loading')
      setOpen(true)

      void getMasterDataSuggestions(
        {
          kind,
          q: value,
          limit: 20,
          company,
          product,
          packagingType,
        },
        controller.signal,
      )
        .then((result) => {
          if (
            controller.signal.aborted ||
            requestVersionRef.current !== requestVersion
          ) {
            return
          }

          setSuggestions(result)
          setActiveIndex(-1)
          setStatus('success')
          setOpen(true)
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            requestVersionRef.current !== requestVersion
          ) {
            return
          }

          setSuggestions([])
          setActiveIndex(-1)

          if (isMasterDataRequestError(error, 'unauthorized')) {
            setStatus('idle')
            setOpen(false)
            onUnauthorized()
            return
          }

          setStatus('error')
          setOpen(true)
        })
    }, SUGGESTION_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()

      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null
      }
    }
  }, [
    company,
    disabled,
    focused,
    kind,
    onUnauthorized,
    packagingType,
    product,
    requestKey,
    value,
  ])

  function closeSuggestions() {
    requestVersionRef.current += 1
    activeControllerRef.current?.abort()
    activeControllerRef.current = null
    setOpen(false)
    setActiveIndex(-1)
  }

  function selectSuggestion(suggestion: MasterDataSuggestion) {
    selectedValueRef.current = suggestion.value
    onChange(suggestion.value)
    setSuggestions([])
    setStatus('idle')
    closeSuggestions()
  }

  const suggestionsAreCurrent = suggestionsRequestKey === requestKey
  const visibleSuggestions =
    suggestionsAreCurrent && status === 'success' ? suggestions : []
  const showPanel =
    !disabled && open && status !== 'idle' && suggestionsAreCurrent
  const hasExactSuggestion = visibleSuggestions.some((suggestion) =>
    valuesMatch(suggestion.value, trimmedValue),
  )
  const hasSuggestionList = showPanel && visibleSuggestions.length > 0
  const hasStatusDescription =
    showPanel &&
    (status === 'loading' ||
      status === 'error' ||
      (status === 'success' &&
        ((!trimmedValue && visibleSuggestions.length === 0) ||
          (Boolean(trimmedValue) && !hasExactSuggestion))))
  const activeOptionId =
    hasSuggestionList && activeIndex >= 0
      ? `${listboxId}-option-${activeIndex}`
      : undefined

  useEffect(() => {
    if (!showPanel || activeIndex < 0) {
      return
    }

    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, showPanel])

  useEffect(
    () => () => {
      if (panelPointerResetTimerRef.current !== null) {
        window.clearTimeout(panelPointerResetTimerRef.current)
      }
    },
    [],
  )

  function markPanelPointerInteraction() {
    panelPointerInteractionRef.current = true

    if (panelPointerResetTimerRef.current !== null) {
      window.clearTimeout(panelPointerResetTimerRef.current)
    }

    panelPointerResetTimerRef.current = window.setTimeout(() => {
      panelPointerInteractionRef.current = false
      panelPointerResetTimerRef.current = null
    }, 0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && visibleSuggestions.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) =>
        current >= visibleSuggestions.length - 1 ? 0 : current + 1,
      )
      return
    }

    if (event.key === 'ArrowUp' && visibleSuggestions.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) =>
        current <= 0 ? visibleSuggestions.length - 1 : current - 1,
      )
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (
        showPanel &&
        activeIndex >= 0 &&
        visibleSuggestions[activeIndex]
      ) {
        selectSuggestion(visibleSuggestions[activeIndex])
      }

      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      closeSuggestions()
      return
    }

    if (event.key === 'Tab' && open) {
      closeSuggestions()
    }
  }

  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={inputId} className="text-xs font-semibold text-zinc-300">
        {label}
      </label>
      <Popover.Root
        open={showPanel}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeSuggestions()
          }
        }}
      >
        <Popover.Anchor asChild>
          <input
            ref={inputRef}
            id={inputId}
            name={name}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={showPanel}
            aria-controls={hasSuggestionList ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            aria-describedby={hasStatusDescription ? statusId : undefined}
            autoComplete="off"
            value={value}
            required={required}
            maxLength={maxLength}
            disabled={disabled}
            onFocus={() => {
              setFocused(true)
              selectedValueRef.current = null
            }}
            onBlur={() => {
              if (panelPointerInteractionRef.current) {
                return
              }

              setFocused(false)
              closeSuggestions()
            }}
            onChange={(event) => {
              selectedValueRef.current = null
              setActiveIndex(-1)
              setOpen(true)
              onChange(event.target.value)
            }}
            onKeyDown={handleKeyDown}
            className={inputClassName}
          />
        </Popover.Anchor>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onWheelCapture={(event) => event.stopPropagation()}
            onPointerDownCapture={markPanelPointerInteraction}
            onFocusOutside={(event) => {
              if (
                event.target instanceof Node &&
                inputRef.current?.contains(event.target)
              ) {
                event.preventDefault()
                return
              }

              if (panelPointerInteractionRef.current) {
                event.preventDefault()
              }
            }}
            onInteractOutside={(event) => {
              if (
                event.target instanceof Node &&
                inputRef.current?.contains(event.target)
              ) {
                event.preventDefault()
                return
              }

              if (!event.defaultPrevented) {
                setFocused(false)
              }
            }}
            className="z-[80] max-h-[min(18rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-lg border border-[var(--brand-green)]/55 bg-[#252b23] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.55)] outline-none"
          >
            {status === 'loading' ? (
              <p
                id={statusId}
                role="status"
                className="px-3 py-3 text-sm text-zinc-400"
              >
                Öneriler yükleniyor…
              </p>
            ) : null}

            {status === 'error' ? (
              <p
                id={statusId}
                role="status"
                className="px-3 py-3 text-sm leading-5 text-[#ffbd94]"
              >
                Öneriler yüklenemedi. Girdiğiniz değeri kullanabilirsiniz.
              </p>
            ) : null}

            {status === 'success' ? (
              <>
                {visibleSuggestions.length > 0 ? (
                  <ul
                    id={listboxId}
                    role="listbox"
                    aria-label={`${label} önerileri`}
                    className="space-y-1"
                  >
                    {visibleSuggestions.map((suggestion, index) => (
                      <li
                        key={suggestion.id}
                        id={`${listboxId}-option-${index}`}
                        ref={(node) => {
                          optionRefs.current[index] = node
                        }}
                        role="option"
                        aria-selected={activeIndex === index}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => selectSuggestion(suggestion)}
                        className={`cursor-pointer rounded-md px-3 py-2.5 text-sm leading-5 outline-none transition-colors ${
                          activeIndex === index
                            ? 'bg-[var(--brand-olive)] text-white'
                            : 'text-zinc-200 hover:bg-white/6'
                        }`}
                      >
                        {suggestion.value}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {trimmedValue && !hasExactSuggestion ? (
                  <p
                    id={statusId}
                    aria-live="polite"
                    className={`${visibleSuggestions.length > 0 ? 'mt-1 border-t border-white/8' : ''} px-3 py-2.5 text-xs leading-5 text-[var(--brand-gold)]`}
                  >
                    “{trimmedValue}” yeni değer olarak kullanılacak.
                  </p>
                ) : null}

                {!trimmedValue && visibleSuggestions.length === 0 ? (
                  <p
                    id={statusId}
                    role="status"
                    className="px-3 py-3 text-sm text-zinc-400"
                  >
                    Henüz öneri yok.
                  </p>
                ) : null}
              </>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
