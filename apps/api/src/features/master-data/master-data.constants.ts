export const MASTER_DATA_KINDS = [
  'company',
  'product',
  'packaging_type',
  'supplier',
  'order_type',
  'process_stage',
] as const;

export const MASTER_DATA_SOURCES = ['csv', 'user', 'backfill'] as const;

export const MASTER_DATA_RELATION_TYPES = [
  'company_product',
  'product_packaging_type',
  'packaging_type_supplier',
  'packaging_type_order_type',
] as const;

export const MASTER_DATA_KIND_MAX_LENGTHS = {
  company: 200,
  product: 250,
  packaging_type: 150,
  supplier: 200,
  order_type: 50,
  process_stage: 150,
} as const;

export const MASTER_DATA_CSV_COLUMNS = {
  company: 'FİRMA İSMİ',
  product: 'ÜRÜN',
  packaging_type: 'AMBALAJ TÜRÜ',
  supplier: 'TEDARİKÇİ FİRMA',
  order_type: 'SİPARİŞ CİNSİ',
  process_stage: 'SÜREÇ AŞAMASI',
} as const;

export const EXPECTED_MASTER_DATA_CSV_HEADERS = [
  'SİPARİŞ KODU',
  'FİRMA İSMİ',
  'ÜRÜN',
  'AMBALAJ TÜRÜ',
  'TEDARİKÇİ FİRMA',
  'SİPARİŞ CİNSİ',
  'STOK',
  'İHTİYAÇ/SİPARİŞ',
  'VERİLEN SİPARİŞ MİKTARI',
  'GELEN SİPARİŞ MİKTARI',
  'SİPARİŞ GELEN TARİH',
  'SİPARİŞ VERİLEN TARİH',
  'SİPARİŞ TERMİN TARİHİ',
  'SİPARİŞ SEVK TARİHİ',
  'SÜREÇ KODU',
  'SÜREÇ AŞAMASI',
  'ÜRÜN DETAY',
  'Event ID',
  'TRELLO CARD ID',
  'TRELLO CARD URL',
  'TRELLO GRUP ANAHTARI',
] as const;

export const MASTER_DATA_SUGGESTION_LIMIT_DEFAULT = 10;
export const MASTER_DATA_SUGGESTION_LIMIT_MAX = 20;
export const MASTER_DATA_QUERY_MAX_LENGTH = 100;

export function isMasterDataKind(value: string): value is MasterDataKind {
  return (MASTER_DATA_KINDS as readonly string[]).includes(value);
}

export function isMasterDataRelationType(
  value: string,
): value is MasterDataRelationType {
  return (MASTER_DATA_RELATION_TYPES as readonly string[]).includes(value);
}

export type MasterDataKind = (typeof MASTER_DATA_KINDS)[number];
export type MasterDataSource = (typeof MASTER_DATA_SOURCES)[number];
export type MasterDataRelationType =
  (typeof MASTER_DATA_RELATION_TYPES)[number];
