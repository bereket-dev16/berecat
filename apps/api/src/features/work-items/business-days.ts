const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): Date {
  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    throw new Error('Tarih YYYY-MM-DD biçiminde olmalıdır.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Tarih geçersiz.');
  }

  return date;
}

function formatIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addBusinessDays(value: string, businessDays: number): string {
  if (!Number.isInteger(businessDays) || businessDays < 0) {
    throw new Error('İş günü sayısı negatif olmayan bir tam sayı olmalıdır.');
  }

  const date = parseIsoDate(value);
  let remaining = businessDays;

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();

    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }

  return formatIsoDate(date);
}
