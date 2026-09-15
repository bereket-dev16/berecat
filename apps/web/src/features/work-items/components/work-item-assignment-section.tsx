import { useState } from 'react'
import {
  claimWorkItem,
  getWorkItemSafeErrorMessage,
  isWorkItemRequestError,
  replaceWorkItemAssignees,
} from '../work-item-api'
import type {
  UserOption,
  UserOptionsStatus,
  WorkItemDetail,
} from '../work-item-types'
import { UserMultiSelect } from './user-multi-select'
import { WorkItemDetailSection } from './work-item-detail-field'

interface WorkItemAssignmentSectionProps {
  workItem: WorkItemDetail
  users: UserOption[]
  userOptionsStatus: UserOptionsStatus
  onRetryUserOptions: () => void
  onReload: () => void
  onUnauthorized: () => void
  claimMessage: string | null
  onClaimMessageChange: (message: string | null) => void
}

export function WorkItemAssignmentSection({
  workItem,
  users,
  userOptionsStatus,
  onRetryUserOptions,
  onReload,
  onUnauthorized,
  claimMessage,
  onClaimMessageChange,
}: WorkItemAssignmentSectionProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    workItem.assignees.map((assignee) => assignee.id),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(
    null,
  )

  async function handleSaveAssignments() {
    if (isSaving) {
      return
    }

    setAssignmentMessage(null)
    setIsSaving(true)

    try {
      const assignees = await replaceWorkItemAssignees(
        workItem.id,
        selectedUserIds,
      )
      setSelectedUserIds(assignees.map((assignee) => assignee.id))
      setAssignmentMessage('Atamalar güncellendi.')
      onClaimMessageChange(null)
      onReload()
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      if (isWorkItemRequestError(error, 'conflict')) {
        setAssignmentMessage(
          getWorkItemSafeErrorMessage(error) ??
            'Tamamlanmış işin ataması değiştirilemez.',
        )
        onReload()
        return
      }

      setAssignmentMessage(
        isWorkItemRequestError(error, 'validation')
          ? 'Seçilen kullanıcılar atanamadı.'
          : 'Atamalar güncellenemedi. Lütfen tekrar deneyin.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClaim() {
    if (isClaiming) {
      return
    }

    onClaimMessageChange(null)
    setIsClaiming(true)

    try {
      const assignees = await claimWorkItem(workItem.id)
      setSelectedUserIds(assignees.map((assignee) => assignee.id))
      onClaimMessageChange('Görev üzerinize alındı.')
      onReload()
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      if (isWorkItemRequestError(error, 'conflict')) {
        onClaimMessageChange(
          getWorkItemSafeErrorMessage(error) ??
            'Bu iş başka bir kullanıcı tarafından alınmış.',
        )
        onReload()
        return
      }

      onClaimMessageChange('Görev üzerinize alınamadı. Lütfen tekrar deneyin.')
    } finally {
      setIsClaiming(false)
    }
  }

  const canClaim =
    workItem.moduleKey === 'incoming-orders' && workItem.assignees.length === 0

  if (workItem.status === 'completed') {
    return (
      <WorkItemDetailSection title="Atanan Kişiler">
        {workItem.assignees.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Güncel atamalar">
            {workItem.assignees.map((assignee) => (
              <li
                key={assignee.id}
                className="rounded-full border border-[var(--brand-green)]/45 bg-[var(--brand-olive)]/55 px-3 py-1.5 text-sm text-zinc-100"
              >
                {assignee.displayName}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-300">Henüz kimse atanmadı.</p>
        )}
        <p className="mt-4 text-sm text-zinc-400">
          Tamamlanmış işlerde atama değiştirilemez.
        </p>
      </WorkItemDetailSection>
    )
  }

  return (
    <WorkItemDetailSection title="Atanan Kişiler">
      {canClaim ? (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={isClaiming}
          aria-busy={isClaiming}
          className="mt-4 min-h-11 rounded-md bg-[#12b76a] px-4 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#39cc83] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-60"
        >
          {isClaiming ? 'Görev alınıyor…' : 'Görevi Üzerime Al'}
        </button>
      ) : null}

      {claimMessage ? (
        <p aria-live="polite" className="mt-3 text-sm text-[#ffd398]">
          {claimMessage}
        </p>
      ) : null}

      <div className="mt-6 border-t border-white/8 pt-5">
        <h3 className="text-sm font-semibold text-zinc-100">
          Atamayı Değiştir
        </h3>

        {userOptionsStatus === 'loading' || userOptionsStatus === 'idle' ? (
          <p role="status" className="mt-3 text-sm text-zinc-300">
            Kullanıcılar yükleniyor…
          </p>
        ) : null}

        {userOptionsStatus === 'error' ? (
          <div role="alert" className="mt-3 text-sm text-[#ffad7d]">
            <p>Kullanıcı seçenekleri yüklenemedi.</p>
            <button
              type="button"
              onClick={onRetryUserOptions}
              className="mt-3 min-h-10 rounded-md border border-[var(--brand-orange)]/60 px-3 font-semibold text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
            >
              Tekrar Dene
            </button>
          </div>
        ) : null}

        {userOptionsStatus === 'success' && users.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-300">
            Atanabilecek aktif kullanıcı yok.
          </p>
        ) : null}

        {userOptionsStatus === 'success' && users.length > 0 ? (
          <div className="mt-3 max-w-md">
            <UserMultiSelect
              users={users}
              selectedIds={selectedUserIds}
              onChange={setSelectedUserIds}
              disabled={isSaving}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSaveAssignments()}
          disabled={isSaving || userOptionsStatus !== 'success'}
          aria-busy={isSaving}
          className="mt-4 min-h-11 rounded-md bg-[var(--brand-orange)] px-4 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#eb8240] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-50"
        >
          {isSaving ? 'Kaydediliyor…' : 'Atamayı Kaydet'}
        </button>

        {assignmentMessage ? (
          <p aria-live="polite" className="mt-3 text-sm text-[#ffd398]">
            {assignmentMessage}
          </p>
        ) : null}
      </div>
    </WorkItemDetailSection>
  )
}
