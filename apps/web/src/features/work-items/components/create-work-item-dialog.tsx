import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { HomeModule } from '../../home/home-types'
import { SmartAutocompleteInput } from '../../master-data/components/smart-autocomplete-input'
import { addBusinessDays } from '../add-business-days'
import {
  createWorkItem,
  getWorkItemSafeErrorMessage,
  isWorkItemRequestError,
  updateWorkItem,
} from '../work-item-api'
import type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  WorkItemDetail,
} from '../work-item-types'
import { useUserOptions } from '../use-user-options'
import { UserMultiSelect } from './user-multi-select'

interface CreateWorkItemDialogProps {
  open: boolean
  module: HomeModule | null
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  onUnauthorized: () => void
  returnFocus: () => void
  mode?: 'create' | 'duplicate' | 'edit'
  initialWorkItem?: WorkItemDetail | null
  initialLoading?: boolean
}

interface CreateWorkItemFormState {
  orderCode: string
  companyName: string
  productName: string
  packagingType: string
  supplierCompany: string
  orderType: string
  stockValue: string
  needOrderValue: string
  orderedQuantity: string
  receivedQuantity: string
  orderReceivedDate: string
  orderPlacedDate: string
  orderDeadlineDate: string
  orderShipmentDate: string
  processStage: string
  productDetail: string
  assigneeIds: string[]
}

type TextFieldName = Exclude<keyof CreateWorkItemFormState, 'assigneeIds'>

const initialFormState: CreateWorkItemFormState = {
  orderCode: '',
  companyName: '',
  productName: '',
  packagingType: '',
  supplierCompany: '',
  orderType: '',
  stockValue: '',
  needOrderValue: '',
  orderedQuantity: '',
  receivedQuantity: '',
  orderReceivedDate: '',
  orderPlacedDate: '',
  orderDeadlineDate: '',
  orderShipmentDate: '',
  processStage: '',
  productDetail: '',
  assigneeIds: [],
}

function valueOrEmpty(value: string | null): string {
  return value ?? ''
}

function createInitialFormState(
  workItem: WorkItemDetail | null | undefined,
): CreateWorkItemFormState {
  if (!workItem) {
    return initialFormState
  }

  return {
    orderCode: valueOrEmpty(workItem.orderCode),
    companyName: workItem.companyName,
    productName: workItem.productName,
    packagingType: valueOrEmpty(workItem.packagingType),
    supplierCompany: valueOrEmpty(workItem.supplierCompany),
    orderType: valueOrEmpty(workItem.orderType),
    stockValue: valueOrEmpty(workItem.stockValue),
    needOrderValue: valueOrEmpty(workItem.needOrderValue),
    orderedQuantity: valueOrEmpty(workItem.orderedQuantity),
    receivedQuantity: valueOrEmpty(workItem.receivedQuantity),
    orderReceivedDate: valueOrEmpty(workItem.orderReceivedDate),
    orderPlacedDate: valueOrEmpty(workItem.orderPlacedDate),
    orderDeadlineDate: valueOrEmpty(workItem.orderDeadlineDate),
    orderShipmentDate: valueOrEmpty(workItem.orderShipmentDate),
    processStage: valueOrEmpty(workItem.processStage),
    productDetail: valueOrEmpty(workItem.productDetail),
    assigneeIds: workItem.assignees.map((assignee) => assignee.id),
  }
}

const inputClassName =
  'mt-2 h-11 w-full rounded-md border border-white/12 bg-black/20 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/25 disabled:cursor-wait disabled:opacity-60'

interface FormGroupProps {
  title: string
  children: ReactNode
}

function FormGroup({ title, children }: FormGroupProps) {
  return (
    <fieldset className="rounded-lg border border-white/9 bg-black/10 p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-[var(--brand-gold)]">
        {title}
      </legend>
      <div className="mt-1 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

interface TextFieldProps {
  label: string
  name: TextFieldName
  value: string
  disabled: boolean
  onChange: (name: TextFieldName, value: string) => void
  type?: 'text' | 'date'
  required?: boolean
  maxLength?: number
  wide?: boolean
}

function TextField({
  label,
  name,
  value,
  disabled,
  onChange,
  type = 'text',
  required = false,
  maxLength,
  wide = false,
}: TextFieldProps) {
  return (
    <label className={wide ? 'sm:col-span-2' : undefined}>
      <span className="text-xs font-semibold text-zinc-300">
        {label}
      </span>
      <input
        name={name}
        type={type}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        className={inputClassName}
      />
    </label>
  )
}

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function CreateWorkItemDialog({
  open,
  module,
  onOpenChange,
  onCreated,
  onUnauthorized,
  returnFocus,
  mode = 'create',
  initialWorkItem = null,
  initialLoading = false,
}: CreateWorkItemDialogProps) {
  const [form, setForm] = useState<CreateWorkItemFormState>(() =>
    createInitialFormState(initialWorkItem),
  )
  const initialAutomaticDeadline = initialWorkItem?.orderPlacedDate
    ? addBusinessDays(initialWorkItem.orderPlacedDate, 10)
    : null
  const [automaticDeadline, setAutomaticDeadline] = useState(
    initialAutomaticDeadline,
  )
  const [isDeadlineManuallyOverridden, setIsDeadlineManuallyOverridden] =
    useState(
      Boolean(
        initialWorkItem?.orderDeadlineDate &&
          initialWorkItem.orderDeadlineDate !== initialAutomaticDeadline,
      ),
    )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const userOptions = useUserOptions(open)

  useEffect(() => {
    if (!open) {
      return
    }

    const nextAutomaticDeadline = initialWorkItem?.orderPlacedDate
      ? addBusinessDays(initialWorkItem.orderPlacedDate, 10)
      : null

    const timeoutId = window.setTimeout(() => {
      setForm(createInitialFormState(initialWorkItem))
      setAutomaticDeadline(nextAutomaticDeadline)
      setIsDeadlineManuallyOverridden(
        Boolean(
          initialWorkItem?.orderDeadlineDate &&
            initialWorkItem.orderDeadlineDate !== nextAutomaticDeadline,
        ),
      )
      setFormError(null)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [initialWorkItem, mode, open])

  useEffect(() => {
    if (userOptions.status === 'unauthorized') {
      onUnauthorized()
    }
  }, [onUnauthorized, userOptions.status])

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) {
      return
    }

    onOpenChange(nextOpen)
  }

  function setTextField(name: TextFieldName, value: string) {
    if (name === 'orderPlacedDate') {
      const nextAutomaticDeadline = value ? addBusinessDays(value, 10) : null

      setForm((current) => {
        const shouldUpdateDeadline =
          !isDeadlineManuallyOverridden ||
          current.orderDeadlineDate.length === 0 ||
          current.orderDeadlineDate === automaticDeadline

        return {
          ...current,
          orderPlacedDate: value,
          orderDeadlineDate: shouldUpdateDeadline
            ? (nextAutomaticDeadline ?? '')
            : current.orderDeadlineDate,
        }
      })
      setAutomaticDeadline(nextAutomaticDeadline)
      return
    }

    if (name === 'orderDeadlineDate') {
      setIsDeadlineManuallyOverridden(value !== (automaticDeadline ?? ''))
    }

    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !module ||
      isSubmitting ||
      (mode === 'edit' && !initialWorkItem)
    ) {
      return
    }

    const companyName = form.companyName.trim()
    const productName = form.productName.trim()

    if (!companyName || !productName) {
      setFormError('Firma İsmi ve Ürün alanları zorunludur.')
      return
    }

    const input: UpdateWorkItemInput = {
      orderCode: nullable(form.orderCode),
      companyName,
      productName,
      packagingType: nullable(form.packagingType),
      supplierCompany: nullable(form.supplierCompany),
      orderType: nullable(form.orderType),
      stockValue: nullable(form.stockValue),
      needOrderValue: nullable(form.needOrderValue),
      orderedQuantity: nullable(form.orderedQuantity),
      receivedQuantity: nullable(form.receivedQuantity),
      orderReceivedDate: nullable(form.orderReceivedDate),
      orderPlacedDate: nullable(form.orderPlacedDate),
      orderDeadlineDate: nullable(form.orderDeadlineDate),
      orderShipmentDate: nullable(form.orderShipmentDate),
      processStage: nullable(form.processStage),
      productDetail: nullable(form.productDetail),
      assigneeIds: form.assigneeIds,
    }

    setFormError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'edit' && initialWorkItem) {
        await updateWorkItem(initialWorkItem.id, input)
      } else {
        const createInput: CreateWorkItemInput = {
          moduleKey: module.id,
          ...input,
        }
        await createWorkItem(createInput)
      }
      setForm(initialFormState)
      setAutomaticDeadline(null)
      setIsDeadlineManuallyOverridden(false)
      onOpenChange(false)
      onCreated()
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      const safeMessage = getWorkItemSafeErrorMessage(error)
      setFormError(
        safeMessage ??
          (isWorkItemRequestError(error, 'validation')
            ? 'Bilgileri kontrol ederek tekrar deneyin.'
            : mode === 'edit'
              ? 'İş güncellenemedi.'
              : 'İş oluşturulamadı. Lütfen tekrar deneyin.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="create-work-item-dialog-overlay"
          className="fixed inset-0 z-50 bg-black/80"
          onClick={() => handleDialogOpenChange(false)}
        />

        {module ? (
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              returnFocus()
            }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[min(calc(100vw-1.5rem),64rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--brand-green)]/70 bg-[var(--dialog-surface)] shadow-[0_24px_90px_rgba(0,0,0,0.65)] outline-none"
          >
            <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[var(--brand-orange)]/60 px-5 py-4 sm:px-6">
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">
                  {mode === 'duplicate'
                    ? 'İşi Çoğalt'
                    : mode === 'edit'
                      ? 'İşi Düzenle'
                      : 'Yeni İş Oluştur'}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-zinc-300">
                  {mode === 'duplicate'
                    ? 'İş bilgilerini düzenleyerek Gelen Siparişler kaydı oluşturun.'
                    : mode === 'edit'
                      ? `${module.title} birimindeki iş bilgilerini güncelleyin.`
                    : `${module.title} modülüne yeni bir iş ekleyin.`}
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label={
                    mode === 'edit'
                      ? 'İş düzenleme penceresini kapat'
                      : mode === 'duplicate'
                        ? 'İş çoğaltma penceresini kapat'
                        : 'İş oluşturma penceresini kapat'
                  }
                  disabled={isSubmitting}
                  className="grid size-10 shrink-0 place-items-center rounded-md text-[var(--brand-gold)] outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-50"
                >
                  <X aria-hidden="true" size={21} />
                </button>
              </Dialog.Close>
            </div>

            {initialLoading ? (
              <div
                role="status"
                className="grid min-h-80 place-items-center px-6 py-12 text-sm text-zinc-300"
              >
                İş bilgileri yükleniyor…
              </div>
            ) : (
            <form
              className="flex min-h-0 flex-1 flex-col"
              autoComplete="off"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <FormGroup title="Temel Bilgiler">
                  <label>
                    <span className="text-xs font-semibold text-zinc-300">
                      Modül
                    </span>
                    <input
                      value={module.title}
                      readOnly
                      aria-readonly="true"
                      autoComplete="off"
                      className={`${inputClassName} cursor-default bg-white/[0.045] text-zinc-300`}
                    />
                  </label>
                  <TextField
                    label="Sipariş Kodu"
                    name="orderCode"
                    value={form.orderCode}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    maxLength={100}
                  />
                  <SmartAutocompleteInput
                    label="Firma İsmi"
                    name="companyName"
                    kind="company"
                    value={form.companyName}
                    disabled={isSubmitting}
                    onChange={(value) => setTextField('companyName', value)}
                    onUnauthorized={onUnauthorized}
                    required
                    maxLength={200}
                  />
                  <SmartAutocompleteInput
                    label="Ürün"
                    name="productName"
                    kind="product"
                    value={form.productName}
                    disabled={isSubmitting}
                    onChange={(value) => setTextField('productName', value)}
                    onUnauthorized={onUnauthorized}
                    context={{ company: form.companyName }}
                    required
                    maxLength={250}
                  />
                  <SmartAutocompleteInput
                    label="Ambalaj Türü"
                    name="packagingType"
                    kind="packaging_type"
                    value={form.packagingType}
                    disabled={isSubmitting}
                    onChange={(value) => setTextField('packagingType', value)}
                    onUnauthorized={onUnauthorized}
                    context={{
                      company: form.companyName,
                      product: form.productName,
                    }}
                    maxLength={150}
                  />
                  <SmartAutocompleteInput
                    label="Tedarikçi Firma"
                    name="supplierCompany"
                    kind="supplier"
                    value={form.supplierCompany}
                    disabled={isSubmitting}
                    onChange={(value) => setTextField('supplierCompany', value)}
                    onUnauthorized={onUnauthorized}
                    context={{ packagingType: form.packagingType }}
                    maxLength={200}
                  />
                  <SmartAutocompleteInput
                    label="Sipariş Cinsi"
                    name="orderType"
                    kind="order_type"
                    value={form.orderType}
                    disabled={isSubmitting}
                    onChange={(value) => setTextField('orderType', value)}
                    onUnauthorized={onUnauthorized}
                    context={{ packagingType: form.packagingType }}
                    maxLength={50}
                  />
                </FormGroup>

                <FormGroup title="Sipariş ve Miktar Bilgileri">
                  <TextField
                    label="Stok"
                    name="stockValue"
                    value={form.stockValue}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    maxLength={100}
                  />
                  <TextField
                    label="İhtiyaç/Sipariş"
                    name="needOrderValue"
                    value={form.needOrderValue}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    maxLength={100}
                  />
                  <TextField
                    label="Verilen Sipariş Miktarı"
                    name="orderedQuantity"
                    value={form.orderedQuantity}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    maxLength={100}
                  />
                  <TextField
                    label="Gelen Sipariş Miktarı"
                    name="receivedQuantity"
                    value={form.receivedQuantity}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    maxLength={100}
                  />
                </FormGroup>

                <FormGroup title="Tarihler">
                  <TextField
                    label="Sipariş Gelen Tarih"
                    name="orderReceivedDate"
                    value={form.orderReceivedDate}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    type="date"
                  />
                  <TextField
                    label="Sipariş Verilen Tarih"
                    name="orderPlacedDate"
                    value={form.orderPlacedDate}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    type="date"
                  />
                  <TextField
                    label="Sipariş Termin Tarihi"
                    name="orderDeadlineDate"
                    value={form.orderDeadlineDate}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    type="date"
                  />
                  <TextField
                    label="Sipariş Sevk Tarihi"
                    name="orderShipmentDate"
                    value={form.orderShipmentDate}
                    disabled={isSubmitting}
                    onChange={setTextField}
                    type="date"
                  />
                </FormGroup>

                <FormGroup title="Süreç ve Ürün Detayı">
                  <SmartAutocompleteInput
                    label="Süreç Aşaması"
                    name="processStage"
                    kind="process_stage"
                    value={form.processStage}
                    disabled={isSubmitting}
                    onChange={(value) => setTextField('processStage', value)}
                    onUnauthorized={onUnauthorized}
                    maxLength={150}
                  />
                  <TextField
                    label="Ürün Detay"
                    name="productDetail"
                    value={form.productDetail}
                    disabled={isSubmitting}
                    onChange={setTextField}
                  />
                </FormGroup>

                <fieldset className="rounded-lg border border-white/9 bg-black/10 p-4 sm:p-5">
                  <legend className="px-1 text-sm font-semibold text-[var(--brand-gold)]">
                    Atama
                  </legend>
                  <p className="mt-1 text-xs font-semibold text-zinc-300">
                    Atanan Kişiler
                  </p>

                  {userOptions.status === 'loading' ? (
                    <p role="status" className="mt-3 text-sm text-zinc-300">
                      Kullanıcılar yükleniyor…
                    </p>
                  ) : null}

                  {userOptions.status === 'error' ? (
                    <div role="alert" className="mt-3 text-sm text-[#ffad7d]">
                      <p>Kullanıcı seçenekleri yüklenemedi.</p>
                      <button
                        type="button"
                        onClick={userOptions.retry}
                        className="mt-3 min-h-10 rounded-md border border-[var(--brand-orange)]/60 px-3 font-semibold text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                      >
                        Tekrar Dene
                      </button>
                    </div>
                  ) : null}

                  {userOptions.status === 'success' &&
                  userOptions.users.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-300">
                      Atanabilecek aktif kullanıcı yok.
                    </p>
                  ) : null}

                  {userOptions.status === 'success' &&
                  userOptions.users.length > 0 ? (
                    <div className="mt-3 max-w-md">
                      <UserMultiSelect
                        users={userOptions.users}
                        selectedIds={form.assigneeIds}
                        onChange={(assigneeIds) =>
                          setForm((current) => ({ ...current, assigneeIds }))
                        }
                        disabled={isSubmitting}
                      />
                    </div>
                  ) : null}
                </fieldset>
              </div>

              <div className="shrink-0 border-t border-white/9 bg-[var(--dialog-surface)] px-5 py-4 sm:px-6">
                <div
                  role={formError ? 'alert' : undefined}
                  aria-live="polite"
                  className="mb-3 min-h-5 text-sm text-[#ffad7d]"
                >
                  {formError}
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      className="min-h-11 rounded-md border border-white/15 px-5 text-sm font-semibold text-zinc-100 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="min-h-11 rounded-md bg-[var(--brand-orange)] px-5 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#eb8240] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSubmitting
                      ? mode === 'edit'
                        ? 'Kaydediliyor…'
                        : 'Oluşturuluyor...'
                      : mode === 'duplicate'
                        ? 'Kopyayı Oluştur'
                        : mode === 'edit'
                          ? 'Değişiklikleri Kaydet'
                          : 'İşi Oluştur'}
                  </button>
                </div>
              </div>
            </form>
            )}
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
