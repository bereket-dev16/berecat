import { Check } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import {
  addWorkItemCommentReaction,
  createWorkItemComment,
  isWorkItemRequestError,
  removeWorkItemCommentReaction,
} from '../work-item-api'
import { formatWorkItemDateTime } from '../format-work-item-date'
import type {
  WorkItemComment,
  WorkItemCommentReactionResult,
  WorkItemDetail,
  WorkItemEvent,
  WorkItemReply,
} from '../work-item-types'
import { WorkItemDetailSection } from './work-item-detail-field'

interface WorkItemActivityPanelProps {
  workItem: WorkItemDetail
  onReload: () => void
  onUnauthorized: () => void
  title?: string
  variant?: 'panel' | 'section'
}

interface ReplyDraft {
  commentId: string
  body: string
  isSubmitting: boolean
  message: string | null
}

interface EventTimelineItem {
  id: string
  createdAt: string
  content: ReactNode
}

interface CommentReactionButtonProps {
  state: WorkItemCommentReactionResult
  pending: boolean
  onToggle: () => void
}

function getInitial(displayName: string): string {
  return displayName.trim().charAt(0).toLocaleUpperCase('tr-TR')
}

function getEventText(event: WorkItemEvent): string {
  if (event.type === 'moved') {
    const fromTitle = event.fromModuleTitle ?? 'önceki birim'
    const toTitle = event.toModuleTitle ?? 'yeni birim'

    return `${event.actor.displayName} işi “${fromTitle}” biriminden “${toTitle}” birimine aktardı.`
  }

  if (event.type === 'completed') {
    return `${event.actor.displayName} işi tamamladı.`
  }

  return `${event.actor.displayName} işi yeniden açtı.`
}

function commentLength(body: string): number {
  return Array.from(body.trim()).length
}

function CommentReactionButton({
  state,
  pending,
  onToggle,
}: CommentReactionButtonProps) {
  const active = state.reactedByCurrentUser

  return (
    <button
      type="button"
      aria-label={active ? 'Onay tepkisini kaldır' : 'Yoruma onay tepkisi ver'}
      aria-pressed={active}
      aria-busy={pending}
      disabled={pending}
      onClick={onToggle}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-wait disabled:opacity-55 ${
        active
          ? 'border-[var(--brand-green)]/55 bg-[var(--brand-green)]/16 text-[#67dfa0]'
          : 'border-white/10 bg-black/10 text-zinc-400 hover:border-white/20 hover:text-zinc-100'
      }`}
    >
      <Check aria-hidden="true" size={15} strokeWidth={2.4} />
      <span>{state.reactionCount}</span>
    </button>
  )
}

interface CommentBodyProps {
  comment: WorkItemComment | WorkItemReply
  isReply?: boolean
  onReply?: () => void
  reactionState: WorkItemCommentReactionResult
  reactionPending: boolean
  reactionError: boolean
  onToggleReaction: () => void
}

function CommentBody({
  comment,
  isReply = false,
  onReply,
  reactionState,
  reactionPending,
  reactionError,
  onToggleReaction,
}: CommentBodyProps) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full bg-[var(--brand-orange)] font-bold text-zinc-950 ${isReply ? 'size-7 text-[0.62rem]' : 'size-9 text-xs'}`}
      >
        {getInitial(comment.author.displayName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-zinc-100">
            {comment.author.displayName}
          </p>
          <time dateTime={comment.createdAt} className="text-xs text-zinc-500">
            {formatWorkItemDateTime(comment.createdAt)}
          </time>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
          {comment.body}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onReply ? (
            <button
              type="button"
              onClick={onReply}
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-[var(--brand-gold)] outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
            >
              Yanıtla
            </button>
          ) : null}
          <CommentReactionButton
            state={reactionState}
            pending={reactionPending}
            onToggle={onToggleReaction}
          />
          {reactionError ? (
            <span role="alert" className="text-xs text-[#ffad7d]">
              Tepki güncellenemedi.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

interface InlineReplyFormProps {
  draft: ReplyDraft
  parentAuthorName: string
  onChange: (body: string) => void
  onCancel: () => void
  onSubmit: () => void
}

function InlineReplyForm({
  draft,
  parentAuthorName,
  onChange,
  onCancel,
  onSubmit,
}: InlineReplyFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const length = commentLength(draft.body)
  const isInvalid = length < 1 || length > 2000

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <form
      className="mt-3 rounded-lg border border-[var(--brand-green)]/35 bg-black/15 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <p className="mb-2 text-xs leading-5 text-zinc-400">
        {parentAuthorName} adlı kullanıcının yorumuna yanıt veriyorsunuz.
      </p>
      <label className="sr-only" htmlFor={`reply-${draft.commentId}`}>
        Yanıtınız
      </label>
      <textarea
        ref={textareaRef}
        id={`reply-${draft.commentId}`}
        value={draft.body}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Yanıtınızı yazın…"
        rows={3}
        disabled={draft.isSubmitting}
        className="w-full resize-y rounded-md border border-white/12 bg-[#191e18] px-3 py-2.5 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/25 disabled:cursor-wait disabled:opacity-60"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p role={draft.message ? 'alert' : undefined} aria-live="polite" className="min-h-5 text-xs text-[#ffcc8f]">
          {length > 2000
            ? 'Yanıt 1 ile 2000 karakter arasında olmalıdır.'
            : draft.message}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Yanıtı İptal Et"
            onClick={onCancel}
            disabled={draft.isSubmitting}
            className="min-h-9 rounded-md px-3 text-xs font-semibold text-zinc-300 outline-none hover:bg-white/6 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:opacity-50"
          >
            İptal
          </button>
          <button
            type="submit"
            aria-label="Yanıt Ekle"
            disabled={isInvalid || draft.isSubmitting}
            aria-busy={draft.isSubmitting}
            className="min-h-9 rounded-md bg-[var(--brand-orange)] px-3 text-xs font-semibold text-zinc-950 outline-none hover:bg-[#eb8240] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {draft.isSubmitting ? 'Yanıtlanıyor…' : 'Yanıtla'}
          </button>
        </div>
      </div>
    </form>
  )
}

export function WorkItemActivityPanel({
  workItem,
  onReload,
  onUnauthorized,
  title = 'Yorumlar ve Etkinlik',
  variant = 'section',
}: WorkItemActivityPanelProps) {
  const textareaId = useId()
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null)
  const [reactionOverrides, setReactionOverrides] = useState<
    Record<string, WorkItemCommentReactionResult>
  >({})
  const [pendingReactionId, setPendingReactionId] = useState<string | null>(null)
  const pendingReactionRef = useRef<string | null>(null)
  const [reactionErrorId, setReactionErrorId] = useState<string | null>(null)
  const trimmedBody = body.trim()
  const bodyCharacterCount = commentLength(body)
  const bodyValidationMessage =
    bodyCharacterCount > 2000
      ? 'Yorum 1 ile 2000 karakter arasında olmalıdır.'
      : null

  const eventTimeline = useMemo<EventTimelineItem[]>(() => {
    const entries: EventTimelineItem[] = [
      {
        id: `created:${workItem.id}`,
        createdAt: workItem.createdAt,
        content: `${workItem.createdBy.displayName} bu işi oluşturdu.`,
      },
      ...workItem.events.map((event) => ({
        id: `event:${event.id}`,
        createdAt: event.createdAt,
        content: getEventText(event),
      })),
    ]

    return entries.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
  }, [workItem])

  function getReactionState(
    comment: WorkItemComment | WorkItemReply,
  ): WorkItemCommentReactionResult {
    return (
      reactionOverrides[comment.id] ?? {
        reactionCount: comment.reactionCount,
        reactedByCurrentUser: comment.reactedByCurrentUser,
      }
    )
  }

  async function toggleReaction(comment: WorkItemComment | WorkItemReply) {
    if (pendingReactionRef.current) {
      return
    }

    const current = getReactionState(comment)
    pendingReactionRef.current = comment.id
    setPendingReactionId(comment.id)
    setReactionErrorId(null)

    try {
      const next = current.reactedByCurrentUser
        ? await removeWorkItemCommentReaction(workItem.id, comment.id)
        : await addWorkItemCommentReaction(workItem.id, comment.id)
      setReactionOverrides((overrides) => ({
        ...overrides,
        [comment.id]: next,
      }))
      onReload()
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setReactionErrorId(comment.id)
    } finally {
      pendingReactionRef.current = null
      setPendingReactionId(null)
    }
  }

  async function handleMainCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (bodyCharacterCount < 1 || bodyCharacterCount > 2000 || isSubmitting) {
      return
    }

    setMessage(null)
    setIsSubmitting(true)

    try {
      await createWorkItemComment(workItem.id, trimmedBody, null)
      setBody('')
      setMessage('Yorum eklendi.')
      onReload()
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setMessage(
        isWorkItemRequestError(error, 'validation')
          ? 'Yorum 1 ile 2000 karakter arasında olmalıdır.'
          : 'Yorum eklenemedi. Lütfen tekrar deneyin.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function startReply(comment: WorkItemComment) {
    setReplyDraft({
      commentId: comment.id,
      body: '',
      isSubmitting: false,
      message: null,
    })
  }

  async function submitReply() {
    if (!replyDraft) {
      return
    }

    const bodyLength = commentLength(replyDraft.body)
    if (bodyLength < 1 || bodyLength > 2000 || replyDraft.isSubmitting) {
      return
    }

    const submittingDraft = { ...replyDraft, isSubmitting: true, message: null }
    setReplyDraft(submittingDraft)

    try {
      await createWorkItemComment(
        workItem.id,
        submittingDraft.body.trim(),
        submittingDraft.commentId,
      )
      setReplyDraft((current) =>
        current?.commentId === submittingDraft.commentId ? null : current,
      )
      onReload()
    } catch (error: unknown) {
      if (isWorkItemRequestError(error, 'unauthorized')) {
        onUnauthorized()
        return
      }

      setReplyDraft((current) =>
        current?.commentId === submittingDraft.commentId
          ? {
              ...current,
              isSubmitting: false,
              message: isWorkItemRequestError(error, 'validation')
                ? 'Yanıt 1 ile 2000 karakter arasında olmalıdır.'
                : 'Yanıt eklenemedi. Lütfen tekrar deneyin.',
            }
          : current,
      )
    }
  }

  const content = (
    <div className="mt-4 space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-zinc-100">
          Yeni Yorum
        </h3>
        <form className="mt-3" onSubmit={(event) => void handleMainCommentSubmit(event)}>
          <label htmlFor={textareaId} className="sr-only">
            Yeni Yorum
          </label>
          <textarea
            id={textareaId}
            value={body}
            onChange={(event) => {
              setBody(event.target.value)
              setMessage(null)
            }}
            rows={3}
            disabled={isSubmitting}
            className="w-full resize-y rounded-md border border-white/12 bg-black/20 px-3 py-2.5 text-sm leading-6 text-zinc-100 outline-none focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/25 disabled:cursor-wait disabled:opacity-60"
          />
          <div className="mt-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p aria-live="polite" className="min-h-5 text-sm text-[#ffd398]">
              {bodyValidationMessage ?? message}
            </p>
            <button
              type="submit"
              disabled={isSubmitting || bodyCharacterCount < 1 || bodyCharacterCount > 2000}
              aria-busy={isSubmitting}
              className="min-h-11 rounded-md bg-[var(--brand-orange)] px-4 text-sm font-semibold text-zinc-950 outline-none hover:bg-[#eb8240] focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Ekleniyor…' : 'Yorum Ekle'}
            </button>
          </div>
        </form>
      </section>

      <section className="border-t border-white/8 pt-5">
        <h3 className="text-sm font-semibold text-white">
          Yorumlar
        </h3>
        {workItem.comments.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">Henüz yorum yok.</p>
        ) : (
          <ol aria-label="İş yorumları" className="mt-4 space-y-4">
            {workItem.comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-xl border border-white/9 bg-[#252c23] p-4 shadow-[0_8px_22px_rgba(0,0,0,0.12)]"
              >
                <CommentBody
                  comment={comment}
                  onReply={() => startReply(comment)}
                  reactionState={getReactionState(comment)}
                  reactionPending={pendingReactionId === comment.id}
                  reactionError={reactionErrorId === comment.id}
                  onToggleReaction={() => void toggleReaction(comment)}
                />
                {replyDraft?.commentId === comment.id ? (
                  <div className="ml-4 border-l border-[var(--brand-green)]/55 pl-3 sm:ml-8 sm:pl-4">
                    <InlineReplyForm
                      draft={replyDraft}
                      parentAuthorName={comment.author.displayName}
                      onChange={(nextBody) =>
                        setReplyDraft((current) =>
                          current ? { ...current, body: nextBody, message: null } : current,
                        )
                      }
                      onCancel={() => setReplyDraft(null)}
                      onSubmit={() => void submitReply()}
                    />
                  </div>
                ) : null}
                {comment.replies.length > 0 ? (
                  <ol
                    aria-label={`${comment.author.displayName} adlı kullanıcının yorumuna verilen yanıtlar`}
                    className="mt-4 space-y-3 border-l border-[var(--brand-green)]/45 pl-3 sm:ml-8 sm:pl-4"
                  >
                    {comment.replies.map((reply) => (
                      <li key={reply.id} className="rounded-lg border border-white/7 bg-[#1e251d] p-3">
                        <CommentBody
                          comment={reply}
                          isReply
                          reactionState={getReactionState(reply)}
                          reactionPending={pendingReactionId === reply.id}
                          reactionError={reactionErrorId === reply.id}
                          onToggleReaction={() => void toggleReaction(reply)}
                        />
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border-t border-white/8 pt-5">
        <h3 className="text-sm font-semibold text-white">
          Etkinlik Geçmişi
        </h3>
        <ol aria-label="İş aktivite geçmişi" className="mt-4 space-y-2">
          {eventTimeline.map((event) => (
            <li key={event.id} className="relative border-l border-white/12 py-1 pl-4 before:absolute before:-left-[0.22rem] before:top-3 before:size-1.5 before:rounded-full before:bg-zinc-500">
              <p className="text-sm leading-6 text-zinc-300">{event.content}</p>
              <time dateTime={event.createdAt} className="mt-1 block text-xs text-zinc-500">
                {formatWorkItemDateTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )

  if (variant === 'section') {
    return <WorkItemDetailSection title={title}>{content}</WorkItemDetailSection>
  }

  return (
    <section>
      <h2 className="border-b border-[var(--brand-orange)]/35 pb-3 text-base font-semibold text-white">
        {title}
      </h2>
      {content}
    </section>
  )
}
