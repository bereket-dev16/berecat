const turkishDateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatHomeDate(date: string): string {
  return turkishDateFormatter.format(new Date(`${date}T00:00:00Z`))
}
