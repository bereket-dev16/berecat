import { describe, expect, it } from 'vitest';

import {
  isMasterDataPlaceholder,
  isSuspiciousMasterDataValue,
  normalizeMasterDataDisplayValue,
  normalizeMasterDataValue,
} from './master-data.normalization.js';

describe('master data normalizasyonu', () => {
  it('baş ve sondaki boşlukları kaldırır', () => {
    expect(normalizeMasterDataDisplayValue('  Örnek Firma  ')).toBe(
      'Örnek Firma',
    );
  });

  it('çoklu boşlukları tek boşluğa indirir', () => {
    expect(normalizeMasterDataDisplayValue('Örnek\t  Firma')).toBe(
      'Örnek Firma',
    );
  });

  it('Unicode NFKC normalizasyonu uygular', () => {
    expect(normalizeMasterDataDisplayValue('ＡＢＣ')).toBe('ABC');
  });

  it.each(['I', 'İ', 'ı', 'i'])(
    'Türkçe %s harfini aynı arama anahtarına dönüştürür',
    (value) => {
      expect(normalizeMasterDataValue(`${value}laç`).normalizedKey).toBe(
        'ilac',
      );
    },
  );

  it('büyük ve küçük harf varyasyonlarını aynı anahtarda birleştirir', () => {
    expect(normalizeMasterDataValue('BİOCARE').normalizedKey).toBe(
      normalizeMasterDataValue('biocare').normalizedKey,
    );
  });

  it('noktalama ve ayraç çevresindeki boşlukları güvenli normalize eder', () => {
    expect(normalizeMasterDataValue('KUTU / ETİKET').normalizedKey).toBe(
      normalizeMasterDataValue('kutu/etiket').normalizedKey,
    );
  });

  it('anlamlı sembolü kaldırarak C+ ile C değerlerini birleştirmez', () => {
    expect(normalizeMasterDataValue('C+').normalizedKey).not.toBe(
      normalizeMasterDataValue('C').normalizedKey,
    );
  });

  it('yüzde işaretini kaldırarak farklı ürün değerlerini birleştirmez', () => {
    expect(normalizeMasterDataValue('ÜRÜN %10').normalizedKey).not.toBe(
      normalizeMasterDataValue('ÜRÜN 10').normalizedKey,
    );
  });

  it('bir harfi farklı olabilecek ticari adları otomatik birleştirmez', () => {
    expect(normalizeMasterDataValue('LAKTOFERRIN').normalizedKey).not.toBe(
      normalizeMasterDataValue('LACTOFERRIN').normalizedKey,
    );
  });

  it.each(['', '   ', '?', '-', '—', 'N/A', 'NULL', 'undefined'])(
    '%j placeholder değerini reddeder',
    (value) => {
      expect(isMasterDataPlaceholder(value)).toBe(true);
    },
  );

  it('gerçek operasyonel MÜŞTERİ değerini placeholder saymaz', () => {
    expect(isMasterDataPlaceholder('MÜŞTERİ')).toBe(false);
  });

  it.each(['+', '%', '🟠'])(
    '%j sembol değerini placeholder değil şüpheli sayar',
    (value) => {
      expect(isMasterDataPlaceholder(value)).toBe(false);
      expect(isSuspiciousMasterDataValue('product', value)).toBe(true);
    },
  );

  it('displayValue yazımını okunabilir biçimde korur', () => {
    expect(normalizeMasterDataValue('  Örnek Ürün X  ').displayValue).toBe(
      'Örnek Ürün X',
    );
  });

  it('Türkçe karakterli ve ASCII aramayı aynı searchValue ile eşler', () => {
    expect(normalizeMasterDataValue('POZİTİF MATBAA').searchValue).toBe(
      'pozitif matbaa',
    );
  });
});
