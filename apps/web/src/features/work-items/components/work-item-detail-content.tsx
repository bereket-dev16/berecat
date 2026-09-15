import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  formatWorkItemDate,
  formatWorkItemDateTime,
} from '../format-work-item-date'
import type { WorkItemDetail } from '../work-item-types'
import { useUserOptions } from '../use-user-options'
import { WorkItemActivityPanel } from './work-item-activity-panel'
import { WorkItemAssignmentSection } from './work-item-assignment-section'
import {
  WorkItemDetailField,
  WorkItemDetailSection,
} from './work-item-detail-field'
import { WorkItemReopenAction } from './work-item-reopen-action'

interface WorkItemDetailContentProps {
  workItem: WorkItemDetail
  onReload: () => void
  onUnauthorized: () => void
}

function valueOrDash(value: string | null): string {
  return value?.trim() || '—'
}

export function WorkItemDetailContent({
  workItem,
  onReload,
  onUnauthorized,
}: WorkItemDetailContentProps) {
  const userOptions = useUserOptions(workItem.status === 'active')
  const [claimMessage, setClaimMessage] = useState<string | null>(null)

  useEffect(() => {
    if (userOptions.status === 'unauthorized') {
      onUnauthorized()
    }
  }, [onUnauthorized, userOptions.status])

  const assignmentKey = workItem.assignees
    .map((assignee) => assignee.id)
    .sort()
    .join(':')

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <Link
        to="/"
        className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-semibold text-[var(--brand-gold)] outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
      >
        <ArrowLeft aria-hidden="true" size={18} />
        Anasayfaya Dön
      </Link>

      <header className="mt-4 border-b border-white/9 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--brand-orange)]">
          {workItem.moduleTitle}
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">
          {workItem.productName}
        </h2>
        <p className="mt-2 text-sm text-zinc-300">{workItem.companyName}</p>
      </header>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <WorkItemDetailSection title="Temel Bilgiler">
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkItemDetailField label="Modül">
              {workItem.moduleTitle}
            </WorkItemDetailField>
            <WorkItemDetailField label="Sipariş Kodu">
              {valueOrDash(workItem.orderCode)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Firma İsmi">
              {workItem.companyName}
            </WorkItemDetailField>
            <WorkItemDetailField label="Ürün">
              {workItem.productName}
            </WorkItemDetailField>
            <WorkItemDetailField label="Ambalaj Türü">
              {valueOrDash(workItem.packagingType)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Tedarikçi Firma">
              {valueOrDash(workItem.supplierCompany)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Sipariş Cinsi" wide>
              {valueOrDash(workItem.orderType)}
            </WorkItemDetailField>
          </dl>
        </WorkItemDetailSection>

        <WorkItemDetailSection title="Sipariş ve Miktar Bilgileri">
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkItemDetailField label="Stok">
              {valueOrDash(workItem.stockValue)}
            </WorkItemDetailField>
            <WorkItemDetailField label="İhtiyaç/Sipariş">
              {valueOrDash(workItem.needOrderValue)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Verilen Sipariş Miktarı">
              {valueOrDash(workItem.orderedQuantity)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Gelen Sipariş Miktarı">
              {valueOrDash(workItem.receivedQuantity)}
            </WorkItemDetailField>
          </dl>
        </WorkItemDetailSection>

        <WorkItemDetailSection title="Tarihler">
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkItemDetailField label="Sipariş Gelen Tarih">
              {formatWorkItemDate(workItem.orderReceivedDate)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Sipariş Verilen Tarih">
              {formatWorkItemDate(workItem.orderPlacedDate)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Sipariş Termin Tarihi">
              {formatWorkItemDate(workItem.orderDeadlineDate)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Sipariş Sevk Tarihi">
              {formatWorkItemDate(workItem.orderShipmentDate)}
            </WorkItemDetailField>
          </dl>
        </WorkItemDetailSection>

        <WorkItemDetailSection title="Süreç ve Ürün Detayı">
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkItemDetailField label="Süreç Aşaması">
              {valueOrDash(workItem.processStage)}
            </WorkItemDetailField>
            <WorkItemDetailField label="Ürün Detay" wide>
              {valueOrDash(workItem.productDetail)}
            </WorkItemDetailField>
          </dl>
        </WorkItemDetailSection>

        <WorkItemDetailSection title="İş Akışı">
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkItemDetailField label="Durum" wide>
              {workItem.status === 'completed'
                ? 'Tamamlandı'
                : 'Devam Ediyor'}
            </WorkItemDetailField>
            {workItem.status === 'completed' ? (
              <>
                <WorkItemDetailField label="Tamamlayan">
                  {workItem.completedBy?.displayName ?? '—'}
                </WorkItemDetailField>
                <WorkItemDetailField label="Tamamlanma Tarihi">
                  {formatWorkItemDateTime(workItem.completedAt)}
                </WorkItemDetailField>
              </>
            ) : null}
          </dl>
          {workItem.status === 'completed' ? (
            <div className="mt-5 border-t border-white/8 pt-5">
              <WorkItemReopenAction
                workItemId={workItem.id}
                status={workItem.status}
                onChanged={onReload}
                onUnauthorized={onUnauthorized}
              />
            </div>
          ) : null}
        </WorkItemDetailSection>

        <WorkItemAssignmentSection
          key={`${workItem.id}:${workItem.status}:${assignmentKey}`}
          workItem={workItem}
          users={userOptions.users}
          userOptionsStatus={userOptions.status}
          onRetryUserOptions={userOptions.retry}
          onReload={onReload}
          onUnauthorized={onUnauthorized}
          claimMessage={claimMessage}
          onClaimMessageChange={setClaimMessage}
        />

        <WorkItemActivityPanel
          workItem={workItem}
          onReload={onReload}
          onUnauthorized={onUnauthorized}
        />

        <div className="xl:col-span-2">
          <WorkItemDetailSection title="Kayıt Bilgileri">
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <WorkItemDetailField label="Oluşturan">
                {workItem.createdBy.displayName}
              </WorkItemDetailField>
              <WorkItemDetailField label="Oluşturulma Tarihi">
                {formatWorkItemDateTime(workItem.createdAt)}
              </WorkItemDetailField>
              <WorkItemDetailField label="Son Güncelleme">
                {formatWorkItemDateTime(workItem.updatedAt)}
              </WorkItemDetailField>
            </dl>
          </WorkItemDetailSection>
        </div>
      </div>
    </div>
  )
}
