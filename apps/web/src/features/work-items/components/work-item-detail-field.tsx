import type { ReactNode } from 'react'

interface WorkItemDetailFieldProps {
  label: string
  children: ReactNode
  wide?: boolean
}

export function WorkItemDetailField({
  label,
  children,
  wide = false,
}: WorkItemDetailFieldProps) {
  return (
    <div
      className={`rounded-md border border-white/7 bg-black/10 px-4 py-3 ${wide ? 'sm:col-span-2' : ''}`}
    >
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-100">
        {children}
      </dd>
    </div>
  )
}

interface WorkItemDetailSectionProps {
  title: string
  children: ReactNode
}

export function WorkItemDetailSection({
  title,
  children,
}: WorkItemDetailSectionProps) {
  return (
    <section className="rounded-lg border border-white/9 bg-[var(--surface-raised)]/65 p-4 sm:p-5">
      <h2 className="border-b border-[var(--brand-orange)]/35 pb-3 text-base font-semibold text-white">
        {title}
      </h2>
      {children}
    </section>
  )
}
