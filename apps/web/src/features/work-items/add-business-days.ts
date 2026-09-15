const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/

function parseCalendarDate(value: string): Date | null {
  if (!calendarDatePattern.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function formatCalendarDate(date: Date): string {
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
  ].join('-')
}

export function addBusinessDays(
  value: string,
  businessDays: number,
): string | null {
  const date = parseCalendarDate(value)

  if (!date || !Number.isInteger(businessDays) || businessDays < 0) {
    return null
  }

  let remainingDays = businessDays

  while (remainingDays > 0) {
    date.setUTCDate(date.getUTCDate() + 1)
    const dayOfWeek = date.getUTCDay()

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remainingDays -= 1
    }
  }

  return formatCalendarDate(date)
}
