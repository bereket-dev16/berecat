const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatWorkItemDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00Z`)) : '—'
}

export function formatWorkItemDateTime(value: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date)
}
