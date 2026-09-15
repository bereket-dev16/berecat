import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  masterDataEntries,
  masterDataRelations,
} from '../../db/schema/index.js';
import { EXPECTED_MASTER_DATA_CSV_HEADERS } from './master-data.constants.js';
import {
  analyzeMasterDataCsv,
  applyMasterDataImport,
} from './master-data.import.js';
import type { MasterDataImportAnalysis } from './master-data.types.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function escapeCsvCell(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

function createRow(values: Record<string, string>): string {
  return EXPECTED_MASTER_DATA_CSV_HEADERS.map((header) =>
    escapeCsvCell(values[header] ?? ''),
  ).join(',');
}

async function createFixture(
  rows: Array<Record<string, string>>,
  options: { bom?: boolean; headers?: string[] } = {},
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'berecat-master-data-'));
  temporaryDirectories.push(directory);
  const filePath = join(directory, 'sentetik-ana-veri.csv');
  const headers = options.headers ?? [...EXPECTED_MASTER_DATA_CSV_HEADERS];
  const content = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(createRow),
  ].join('\n');
  await writeFile(filePath, `${options.bom ? '\uFEFF' : ''}${content}\n`, 'utf8');
  return filePath;
}

function entry(
  analysis: MasterDataImportAnalysis,
  kind: string,
  normalizedKey: string,
) {
  return analysis.entries.find(
    (candidate) =>
      candidate.kind === kind && candidate.normalizedKey === normalizedKey,
  );
}

describe('master data CSV analizi', () => {
  it('UTF-8 BOM ve trim edilmiş header isimlerini okur', async () => {
    const headers: string[] = [...EXPECTED_MASTER_DATA_CSV_HEADERS];
    headers[headers.indexOf('ÜRÜN')] = ' ÜRÜN ';
    const filePath = await createFixture(
      [{ ÜRÜN: 'Sentetik Ürün' }],
      { bom: true, headers },
    );

    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.totalRows).toBe(1);
    expect(analysis.summary.missingHeaderCount).toBe(0);
    expect(entry(analysis, 'product', 'sentetik urun')).toBeDefined();
  });

  it('quoted comma içeren alanı tek hücre olarak korur', async () => {
    const filePath = await createFixture([
      { 'FİRMA İSMİ': 'Deneme, Üretim', ÜRÜN: 'Ürün A' },
    ]);

    const analysis = await analyzeMasterDataCsv(filePath);

    expect(entry(analysis, 'company', 'deneme,uretim')?.displayValue).toBe(
      'Deneme, Üretim',
    );
    expect(analysis.summary.columnMismatchRowCount).toBe(0);
  });

  it('firma hücresini yalnız ilişki çıkarımı için forward-fill eder', async () => {
    const filePath = await createFixture([
      { 'FİRMA İSMİ': 'Sentetik Firma', ÜRÜN: 'Ürün Bir' },
      { ÜRÜN: 'Ürün İki' },
    ]);

    const analysis = await analyzeMasterDataCsv(filePath);
    const companyRelations = analysis.relations.filter(
      (relation) => relation.relationType === 'company_product',
    );

    expect(companyRelations).toHaveLength(2);
    expect(analysis.summary.rawValueCountByKind.company).toBe(1);
    expect(analysis.summary.productsWithoutCompany).toBe(0);
  });

  it('firma–ürün ilişkisini çıkarır', async () => {
    const filePath = await createFixture([
      { 'FİRMA İSMİ': 'Firma A', ÜRÜN: 'Ürün A' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.relations).toContainEqual(
      expect.objectContaining({
        relationType: 'company_product',
        fromNormalizedKey: 'firma a',
        toNormalizedKey: 'urun a',
      }),
    );
  });

  it('ürün–ambalaj ilişkisini çıkarır', async () => {
    const filePath = await createFixture([
      { ÜRÜN: 'Ürün A', 'AMBALAJ TÜRÜ': 'Kutu' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.relations).toContainEqual(
      expect.objectContaining({
        relationType: 'product_packaging_type',
        fromNormalizedKey: 'urun a',
        toNormalizedKey: 'kutu',
      }),
    );
  });

  it('ambalaj–tedarikçi ilişkisini çıkarır', async () => {
    const filePath = await createFixture([
      { 'AMBALAJ TÜRÜ': 'Etiket', 'TEDARİKÇİ FİRMA': 'Matbaa A' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.relations).toContainEqual(
      expect.objectContaining({
        relationType: 'packaging_type_supplier',
        fromNormalizedKey: 'etiket',
        toNormalizedKey: 'matbaa a',
      }),
    );
  });

  it('ambalaj–sipariş cinsi ilişkisini çıkarır', async () => {
    const filePath = await createFixture([
      { 'AMBALAJ TÜRÜ': 'Şişe', 'SİPARİŞ CİNSİ': 'Adet' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.relations).toContainEqual(
      expect.objectContaining({
        relationType: 'packaging_type_order_type',
        fromNormalizedKey: 'sise',
        toNormalizedKey: 'adet',
      }),
    );
  });

  it('güvenli Türkçe varyasyonlarını tek entry altında toplar', async () => {
    const filePath = await createFixture([
      { ÜRÜN: 'BİOCARE' },
      { ÜRÜN: 'BIOCARE' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.entries.filter((value) => value.kind === 'product')).toHaveLength(1);
    expect(analysis.summary.safeDuplicateGroupCountByKind.product).toBe(1);
    expect(entry(analysis, 'product', 'biocare')?.usageCount).toBe(2);
  });

  it('ham whitespace ve NFKC varyantlarını raporda kaybetmeden güvenli birleştirir', async () => {
    const filePath = await createFixture([
      { ÜRÜN: '  BIOCARE  ' },
      { ÜRÜN: 'BIOCARE' },
      { ÜRÜN: 'ＢＩＯＣＡＲＥ' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.rawValueCountByKind.product).toBe(3);
    expect(analysis.summary.rawUniqueCountByKind.product).toBe(3);
    expect(analysis.summary.normalizedUniqueCountByKind.product).toBe(1);
    expect(analysis.summary.safeDuplicateGroupCountByKind.product).toBe(1);
    expect(entry(analysis, 'product', 'biocare')).toMatchObject({
      displayValue: 'BIOCARE',
      usageCount: 3,
    });
  });

  it('en sık görülen display varyantını canonical seçer', async () => {
    const filePath = await createFixture([
      { ÜRÜN: 'BIOCARE' },
      { ÜRÜN: 'BİOCARE' },
      { ÜRÜN: 'BİOCARE' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(entry(analysis, 'product', 'biocare')?.displayValue).toBe('BİOCARE');
  });

  it('eşit kullanımda ilk display varyantını canonical seçer', async () => {
    const filePath = await createFixture([
      { ÜRÜN: 'BIOCARE' },
      { ÜRÜN: 'BİOCARE' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(entry(analysis, 'product', 'biocare')?.displayValue).toBe('BIOCARE');
  });

  it('fuzzy adayı raporlar fakat otomatik birleştirmez', async () => {
    const filePath = await createFixture([
      { ÜRÜN: 'LAKTOFERRIN' },
      { ÜRÜN: 'LACTOFERRIN' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.entries.filter((value) => value.kind === 'product')).toHaveLength(2);
    expect(analysis.summary.fuzzyCandidateCountByKind.product).toBe(1);
  });

  it('placeholder değerleri atlar, MÜŞTERİ tedarikçisini korur', async () => {
    const filePath = await createFixture([
      { ÜRÜN: '?', 'TEDARİKÇİ FİRMA': 'MÜŞTERİ' },
      { ÜRÜN: 'N/A' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.placeholderValues).toBe(2);
    expect(entry(analysis, 'supplier', 'musteri')).toBeDefined();
    expect(analysis.entries.some((value) => value.kind === 'product')).toBe(false);
  });

  it('yalnız sembolden oluşan değerleri şüpheli olarak raporlayıp atlar', async () => {
    const filePath = await createFixture([
      { ÜRÜN: '+', 'AMBALAJ TÜRÜ': '%', 'SÜREÇ AŞAMASI': '🟠' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.suspiciousValues).toBe(3);
    expect(analysis.summary.placeholderValues).toBe(0);
    expect(analysis.summary.skippedValues).toBe(3);
    expect(analysis.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '+', reason: 'suspicious' }),
        expect.objectContaining({ value: '%', reason: 'suspicious' }),
        expect.objectContaining({ value: '🟠', reason: 'suspicious' }),
      ]),
    );
    expect(analysis.entries).toHaveLength(0);
  });

  it('açıkça kategori dışı şüpheli değeri apply listesinden çıkarır', async () => {
    const filePath = await createFixture([
      { 'FİRMA İSMİ': '123456', ÜRÜN: 'Sentetik Ürün' },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.suspiciousValues).toBe(1);
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ kind: 'company', reason: 'suspicious' }),
    );
    expect(analysis.entries.some((value) => value.kind === 'company')).toBe(false);
  });

  it('maksimum uzunluğu aşan değeri kesmeden atlar', async () => {
    const longOrderType = 'X'.repeat(51);
    const filePath = await createFixture([
      { 'SİPARİŞ CİNSİ': longOrderType },
    ]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.overlengthValues).toBe(1);
    expect(analysis.issues[0]?.value).toBe(longOrderType);
    expect(analysis.entries).toHaveLength(0);
  });

  it('firma bilgisi olmayan ürünü global entry tutar ve ilişki kurmaz', async () => {
    const filePath = await createFixture([{ ÜRÜN: 'Bağımsız Ürün' }]);
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(entry(analysis, 'product', 'bagimsiz urun')).toBeDefined();
    expect(analysis.summary.productsWithoutCompany).toBe(1);
    expect(analysis.summary.relationCountByType.company_product).toBe(0);
  });

  it('eksik header bilgisini blocking parser problemi olarak raporlar', async () => {
    const headers = EXPECTED_MASTER_DATA_CSV_HEADERS.filter(
      (header) => header !== 'ÜRÜN',
    );
    const filePath = await createFixture([], { headers });
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.missingHeaderCount).toBe(1);
    expect(analysis.summary.blockingProblemCount).toBeGreaterThan(0);
  });

  it('fazla header sayısını satır verilerini loglamadan raporlar', async () => {
    const headers = [...EXPECTED_MASTER_DATA_CSV_HEADERS, 'FAZLA KOLON'];
    const filePath = await createFixture([], { headers });
    const analysis = await analyzeMasterDataCsv(filePath);

    expect(analysis.summary.extraHeaderCount).toBe(1);
    expect(analysis.blockingProblems.join(' ')).not.toContain('FAZLA KOLON');
  });

  it('dry-run analizi veritabanı bağımlılığı olmadan tamamlanır', async () => {
    const filePath = await createFixture([{ ÜRÜN: 'Sentetik Ürün' }]);

    await expect(analyzeMasterDataCsv(filePath)).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ totalRows: 1 }),
      }),
    );
  });

  it('analiz çıktısında work_items kaydı veya ham satır koleksiyonu üretmez', async () => {
    const filePath = await createFixture([{ ÜRÜN: 'Sentetik Ürün' }]);
    const analysis = await analyzeMasterDataCsv(filePath);
    const serialized = JSON.stringify(analysis);

    expect(serialized).not.toContain('work_items');
    expect(analysis).not.toHaveProperty('rows');
    expect(analysis).not.toHaveProperty('rawRows');
  });
});

function emptyAnalysis(hash = 'a'.repeat(64)): MasterDataImportAnalysis {
  return {
    fileSha256: hash,
    sourceFilename: 'sentetik.csv',
    entries: [],
    relations: [],
    issues: [],
    fuzzyCandidates: [],
    blockingProblems: [],
    summary: {
      totalRows: 0,
      nonEmptyProductRows: 0,
      acceptedValues: 0,
      skippedValues: 0,
      placeholderValues: 0,
      overlengthValues: 0,
      suspiciousValues: 0,
      productsWithoutCompany: 0,
      rawValueCountByKind: {
        company: 0,
        product: 0,
        packaging_type: 0,
        supplier: 0,
        order_type: 0,
        process_stage: 0,
      },
      rawUniqueCountByKind: {
        company: 0,
        product: 0,
        packaging_type: 0,
        supplier: 0,
        order_type: 0,
        process_stage: 0,
      },
      normalizedUniqueCountByKind: {
        company: 0,
        product: 0,
        packaging_type: 0,
        supplier: 0,
        order_type: 0,
        process_stage: 0,
      },
      safeDuplicateGroupCountByKind: {
        company: 0,
        product: 0,
        packaging_type: 0,
        supplier: 0,
        order_type: 0,
        process_stage: 0,
      },
      fuzzyCandidateCountByKind: {
        company: 0,
        product: 0,
        packaging_type: 0,
        supplier: 0,
        order_type: 0,
        process_stage: 0,
      },
      relationCountByType: {
        company_product: 0,
        product_packaging_type: 0,
        packaging_type_supplier: 0,
        packaging_type_order_type: 0,
      },
      relationUsageCountByType: {
        company_product: 0,
        product_packaging_type: 0,
        packaging_type_supplier: 0,
        packaging_type_order_type: 0,
      },
      missingHeaderCount: 0,
      extraHeaderCount: 0,
      columnMismatchRowCount: 0,
      blockingProblemCount: 0,
    },
  };
}

function createEmptyApplyDatabase(options: {
  existingBatchHash?: string;
  failInsert?: boolean;
}) {
  let committed = false;
  let rolledBack = false;
  let insertedBatch: unknown;
  const callOrder: string[] = [];
  const transactionClient = {
    execute: vi.fn(async () => {
      callOrder.push('lock');
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => {
        callOrder.push('batch-select');
        return {
        limit: vi.fn(async () =>
          options.existingBatchHash
            ? [{ id: 'batch-id', fileSha256: options.existingBatchHash }]
            : [],
        ),
        where: vi.fn(() => ({
          limit: vi.fn(async () =>
            options.existingBatchHash
              ? [{ id: 'batch-id', fileSha256: options.existingBatchHash }]
              : [],
          ),
        })),
      };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (value: unknown) => {
        insertedBatch = value;

        if (options.failInsert) {
          throw new Error('Sentetik transaction hatası.');
        }
      }),
    })),
  };
  const transaction = vi.fn(
    async (callback: (client: typeof transactionClient) => Promise<unknown>) => {
      try {
        const result = await callback(transactionClient);
        committed = true;
        return result;
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
  );

  return {
    database: { transaction },
    transactionClient,
    getCommitted: () => committed,
    getRolledBack: () => rolledBack,
    getInsertedBatch: () => insertedBatch,
    getCallOrder: () => callOrder,
  };
}

describe('master data CSV apply transaction sınırı', () => {
  it('aynı hash ikinci apply işleminde başarılı no-op olur', async () => {
    const hash = 'a'.repeat(64);
    const harness = createEmptyApplyDatabase({ existingBatchHash: hash });

    await expect(
      applyMasterDataImport(harness.database as never, emptyAnalysis(hash)),
    ).resolves.toEqual({ status: 'already-applied' });
    expect(harness.transactionClient.insert).not.toHaveBeenCalled();
    expect(harness.getCallOrder().slice(0, 2)).toEqual([
      'lock',
      'batch-select',
    ]);
  });

  it('farklı hash ile kümülatif ikinci başlangıç importunu reddeder', async () => {
    const harness = createEmptyApplyDatabase({
      existingBatchHash: 'b'.repeat(64),
    });

    await expect(
      applyMasterDataImport(harness.database as never, emptyAnalysis()),
    ).rejects.toThrow('farklı bir dosyadan');
    expect(harness.transactionClient.insert).not.toHaveBeenCalled();
  });

  it('apply sonucunda yalnız sayısal/kategori summary ile batch oluşturur', async () => {
    const harness = createEmptyApplyDatabase({});

    await expect(
      applyMasterDataImport(harness.database as never, emptyAnalysis()),
    ).resolves.toEqual({
      status: 'applied',
      insertedEntries: 0,
      updatedEntries: 0,
      insertedRelations: 0,
    });
    expect(JSON.stringify(harness.getInsertedBatch())).not.toContain('rows');
    expect(JSON.stringify(harness.getInsertedBatch())).not.toContain('issues');
  });

  it('non-empty apply entry ve relation upsert ederken mevcut görünüm ve kaynağı korur', async () => {
    const analysis = emptyAnalysis();
    analysis.entries = [
      {
        kind: 'company',
        displayValue: 'FİRMA A',
        normalizedKey: 'firma a',
        searchValue: 'firma a',
        usageCount: 2,
      },
      {
        kind: 'product',
        displayValue: 'ÜRÜN A',
        normalizedKey: 'urun a',
        searchValue: 'urun a',
        usageCount: 2,
      },
      {
        kind: 'packaging_type',
        displayValue: 'Kutu',
        normalizedKey: 'kutu',
        searchValue: 'kutu',
        usageCount: 1,
      },
    ];
    analysis.relations = [
      {
        relationType: 'company_product',
        fromKind: 'company',
        fromNormalizedKey: 'firma a',
        toKind: 'product',
        toNormalizedKey: 'urun a',
        usageCount: 2,
      },
      {
        relationType: 'product_packaging_type',
        fromKind: 'product',
        fromNormalizedKey: 'urun a',
        toKind: 'packaging_type',
        toNormalizedKey: 'kutu',
        usageCount: 1,
      },
    ];
    analysis.summary.acceptedValues = 5;
    analysis.summary.normalizedUniqueCountByKind.company = 1;
    analysis.summary.normalizedUniqueCountByKind.product = 1;
    analysis.summary.normalizedUniqueCountByKind.packaging_type = 1;
    analysis.summary.relationCountByType.company_product = 1;
    analysis.summary.relationCountByType.product_packaging_type = 1;
    const companyId = '10000000-0000-4000-8000-000000000001';
    const productId = '10000000-0000-4000-8000-000000000002';
    const packagingId = '10000000-0000-4000-8000-000000000003';
    const storedEntries = new Map([
      [
        'company\u0000firma a',
        {
          id: companyId,
          kind: 'company',
          displayValue: 'Kullanıcı Firma Yazımı',
          normalizedKey: 'firma a',
          searchValue: 'firma a',
          source: 'user',
          usageCount: 5,
          isActive: false,
        },
      ],
      [
        'product\u0000urun a',
        {
          id: productId,
          kind: 'product',
          displayValue: 'Kullanıcı Ürün Yazımı',
          normalizedKey: 'urun a',
          searchValue: 'urun a',
          source: 'user',
          usageCount: 4,
          isActive: true,
        },
      ],
    ]);
    const storedRelations = new Map([
      [
        `company_product\u0000${companyId}\u0000${productId}`,
        {
          relationType: 'company_product',
          fromEntryId: companyId,
          toEntryId: productId,
          usageCount: 3,
        },
      ],
    ]);
    let selectSequence = 0;
    let insertedBatch: Record<string, unknown> | undefined;
    const tx = {
      async execute() {},
      select() {
        selectSequence += 1;
        const currentSequence = selectSequence;

        return {
          from() {
            if (currentSequence === 1) {
              return { async limit() { return []; } };
            }

            return {
              async where() {
                if (currentSequence === 2) {
                  return [{ kind: 'company', normalizedKey: 'firma a' }];
                }

                if (currentSequence === 3) {
                  return [{ kind: 'product', normalizedKey: 'urun a' }];
                }

                if (currentSequence === 4) {
                  return [];
                }

                return [...storedRelations.values()];
              },
            };
          },
        };
      },
      insert(table: unknown) {
        return {
          values(values: Record<string, unknown> | Array<Record<string, unknown>>) {
            if (table === masterDataEntries) {
              return {
                onConflictDoUpdate() {
                  const rows = (values as Array<Record<string, unknown>>).map((value) => {
                    const key = `${String(value.kind)}\u0000${String(value.normalizedKey)}`;
                    const existing = storedEntries.get(key);

                    if (existing) {
                      existing.usageCount += Number(value.usageCount);
                      return {
                        id: existing.id,
                        kind: existing.kind,
                        normalizedKey: existing.normalizedKey,
                      };
                    }

                    const created = {
                      id: packagingId,
                      kind: String(value.kind),
                      displayValue: String(value.displayValue),
                      normalizedKey: String(value.normalizedKey),
                      searchValue: String(value.searchValue),
                      source: String(value.source),
                      usageCount: Number(value.usageCount),
                      isActive: true,
                    };
                    storedEntries.set(key, created);
                    return {
                      id: created.id,
                      kind: created.kind,
                      normalizedKey: created.normalizedKey,
                    };
                  });

                  return { async returning() { return rows; } };
                },
              };
            }

            if (table === masterDataRelations) {
              return {
                async onConflictDoUpdate() {
                  for (const value of values as Array<Record<string, unknown>>) {
                    const key = `${String(value.relationType)}\u0000${String(value.fromEntryId)}\u0000${String(value.toEntryId)}`;
                    const existing = storedRelations.get(key);

                    if (existing) {
                      existing.usageCount += Number(value.usageCount);
                    } else {
                      storedRelations.set(key, {
                        relationType: String(value.relationType),
                        fromEntryId: String(value.fromEntryId),
                        toEntryId: String(value.toEntryId),
                        usageCount: Number(value.usageCount),
                      });
                    }
                  }
                },
              };
            }

            insertedBatch = values as Record<string, unknown>;
            return Promise.resolve();
          },
        };
      },
    };
    const database = {
      async transaction(callback: (client: typeof tx) => Promise<unknown>) {
        return callback(tx);
      },
    };

    const result = await applyMasterDataImport(database as never, analysis);

    expect(result).toEqual({
      status: 'applied',
      insertedEntries: 1,
      updatedEntries: 2,
      insertedRelations: 1,
    });
    expect(storedEntries.get('company\u0000firma a')).toMatchObject({
      displayValue: 'Kullanıcı Firma Yazımı',
      source: 'user',
      isActive: false,
      usageCount: 7,
    });
    expect(storedEntries.get('packaging_type\u0000kutu')).toMatchObject({
      source: 'csv',
      usageCount: 1,
    });
    expect(storedRelations.get(
      `company_product\u0000${companyId}\u0000${productId}`,
    )?.usageCount).toBe(5);
    expect(storedRelations.get(
      `product_packaging_type\u0000${productId}\u0000${packagingId}`,
    )?.usageCount).toBe(1);
    expect(JSON.stringify(insertedBatch)).not.toContain('issues');
    expect(JSON.stringify(insertedBatch)).not.toContain('fuzzyCandidates');
  });

  it('import batch inserti başarısız olduğunda transaction rollback olur', async () => {
    const harness = createEmptyApplyDatabase({ failInsert: true });

    await expect(
      applyMasterDataImport(harness.database as never, emptyAnalysis()),
    ).rejects.toThrow('Sentetik transaction hatası.');
    expect(harness.getCommitted()).toBe(false);
    expect(harness.getRolledBack()).toBe(true);
  });

  it('blocking parser problemi bulunan analizi transaction açmadan reddeder', async () => {
    const harness = createEmptyApplyDatabase({});
    const analysis = emptyAnalysis();
    analysis.blockingProblems.push('Sentetik parser sorunu.');

    await expect(
      applyMasterDataImport(harness.database as never, analysis),
    ).rejects.toThrow('parser sorunları');
    expect(harness.database.transaction).not.toHaveBeenCalled();
  });
});
