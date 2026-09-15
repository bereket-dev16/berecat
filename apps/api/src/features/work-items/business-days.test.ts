import { describe, expect, it } from 'vitest';

import { addBusinessDays } from './business-days.js';

describe('addBusinessDays', () => {
  it('pazartesi gününe başlangıcı saymadan 10 iş günü ekler', () => {
    expect(addBusinessDays('2026-09-14', 10)).toBe('2026-09-28');
  });

  it('cuma gününden sonraki hafta sonlarını atlar', () => {
    expect(addBusinessDays('2026-09-18', 10)).toBe('2026-10-02');
  });

  it('başlangıç gününü iş günü sayımına dahil etmez', () => {
    expect(addBusinessDays('2026-09-14', 1)).toBe('2026-09-15');
  });

  it('YYYY-MM-DD değerini UTC alanlarıyla işler ve timezone kayması üretmez', () => {
    expect(addBusinessDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
