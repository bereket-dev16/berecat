import { describe, expect, it } from 'vitest'
import { addBusinessDays } from './add-business-days'

describe('addBusinessDays', () => {
  it('pazartesiden başlayarak 10 iş günü sonrasındaki pazartesiyi bulur', () => {
    expect(addBusinessDays('2026-09-07', 10)).toBe('2026-09-21')
  })

  it('iş günü eklerken hafta sonunu atlar', () => {
    expect(addBusinessDays('2026-09-11', 1)).toBe('2026-09-14')
  })

  it('başlangıç gününü sayıma dahil etmez', () => {
    expect(addBusinessDays('2026-09-07', 1)).toBe('2026-09-08')
  })

  it('YYYY-MM-DD değerini timezone kayması olmadan aynı formatta döndürür', () => {
    expect(addBusinessDays('2026-03-27', 1)).toBe('2026-03-30')
    expect(addBusinessDays('2026-09-07', 0)).toBe('2026-09-07')
  })

  it('geçersiz tarih ve iş günü değerlerini reddeder', () => {
    expect(addBusinessDays('2026/09/07', 1)).toBeNull()
    expect(addBusinessDays('2026-02-30', 1)).toBeNull()
    expect(addBusinessDays('2026-09-07', -1)).toBeNull()
    expect(addBusinessDays('2026-09-07', 1.5)).toBeNull()
  })
})
