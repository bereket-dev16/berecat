import { describe, expect, it, vi } from 'vitest';

import {
  masterDataEntries,
  masterDataRelations,
  workItems,
} from '../../db/schema/index.js';
import { backfillMasterDataFromWorkItems } from './master-data.backfill.js';
import type { MasterDataWorkItemValues } from './master-data.types.js';

function createBackfillDatabase(workItemRows: MasterDataWorkItemValues[]) {
  const entries = new Map<
    string,
    {
      id: string;
      kind: string;
      normalizedKey: string;
      displayValue: string;
      source: string;
      usageCount: number;
    }
  >();
  const relations = new Map<
    string,
    {
      relationType: string;
      fromEntryId: string;
      toEntryId: string;
      usageCount: number;
    }
  >();
  let entrySequence = 1;
  const where = vi.fn(async () => workItemRows.map((row) => ({ ...row })));
  const update = vi.fn(() => {
    throw new Error('Backfill work_items update etmemelidir.');
  });
  const deleteQuery = vi.fn(() => {
    throw new Error('Backfill work_items silmemelidir.');
  });
  const tx = {
    select() {
      return {
        from(table: unknown) {
          if (table !== workItems) {
            throw new Error('Sentetik backfill beklenmeyen tablo okudu.');
          }

          return { where };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Array<Record<string, unknown>>) {
          if (table === masterDataEntries) {
            return {
              onConflictDoUpdate() {
                const returned = values.map((value) => {
                  const key = `${String(value.kind)}\u0000${String(value.normalizedKey)}`;
                  let stored = entries.get(key);

                  if (stored) {
                    stored.usageCount = Math.max(
                      stored.usageCount,
                      Number(value.usageCount),
                    );
                  } else {
                    stored = {
                      id: `10000000-0000-4000-8000-${String(entrySequence).padStart(12, '0')}`,
                      kind: String(value.kind),
                      normalizedKey: String(value.normalizedKey),
                      displayValue: String(value.displayValue),
                      source: String(value.source),
                      usageCount: Number(value.usageCount),
                    };
                    entrySequence += 1;
                    entries.set(key, stored);
                  }

                  return {
                    id: stored.id,
                    kind: stored.kind,
                    normalizedKey: stored.normalizedKey,
                  };
                });

                return { async returning() { return returned; } };
              },
            };
          }

          if (table !== masterDataRelations) {
            throw new Error('Sentetik backfill beklenmeyen tabloya yazdı.');
          }

          return {
            async onConflictDoUpdate() {
              for (const value of values) {
                const key = `${String(value.relationType)}\u0000${String(value.fromEntryId)}\u0000${String(value.toEntryId)}`;
                const stored = relations.get(key);

                if (stored) {
                  stored.usageCount = Math.max(
                    stored.usageCount,
                    Number(value.usageCount),
                  );
                } else {
                  relations.set(key, {
                    relationType: String(value.relationType),
                    fromEntryId: String(value.fromEntryId),
                    toEntryId: String(value.toEntryId),
                    usageCount: Number(value.usageCount),
                  });
                }
              }
            },
          };
        },
      };
    },
    update,
    delete: deleteQuery,
  };
  const transaction = vi.fn(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  );

  return {
    database: { transaction },
    entries,
    relations,
    where,
    update,
    deleteQuery,
  };
}

const COMPLETE_VALUES: MasterDataWorkItemValues = {
  companyName: 'Backfill Firma',
  productName: 'Backfill Ürün',
  packagingType: 'Kutu',
  supplierCompany: 'Backfill Tedarikçi',
  orderType: 'Adet',
  processStage: 'Kontrol',
};

describe('work item master data backfill', () => {
  it('soft delete sorgu filtresiyle okunan active ve completed snapshotları toplar', async () => {
    const harness = createBackfillDatabase([
      COMPLETE_VALUES,
      { ...COMPLETE_VALUES, productName: 'Tamamlanmış Ürün' },
    ]);

    const result = await backfillMasterDataFromWorkItems(
      harness.database as never,
    );

    expect(result.processedWorkItems).toBe(2);
    expect(harness.where).toHaveBeenCalledTimes(1);
    expect(harness.entries.has('product\u0000tamamlanmis urun')).toBe(true);
  });

  it('work_items snapshotlarını yeniden yazmaz veya silmez', async () => {
    const rows = [structuredClone(COMPLETE_VALUES)];
    const originalRows = structuredClone(rows);
    const harness = createBackfillDatabase(rows);

    await backfillMasterDataFromWorkItems(harness.database as never);

    expect(rows).toEqual(originalRows);
    expect(harness.update).not.toHaveBeenCalled();
    expect(harness.deleteQuery).not.toHaveBeenCalled();
  });

  it('altı entry ve dört relation üretir', async () => {
    const harness = createBackfillDatabase([COMPLETE_VALUES]);

    const result = await backfillMasterDataFromWorkItems(
      harness.database as never,
    );

    expect(result).toEqual({
      processedWorkItems: 1,
      entriesSeen: 6,
      relationsSeen: 4,
    });
    expect(harness.entries).toHaveLength(6);
    expect(harness.relations).toHaveLength(4);
  });

  it('aynı snapshotlar tekrar backfill edildiğinde duplicate veya count şişmesi oluşturmaz', async () => {
    const harness = createBackfillDatabase([
      COMPLETE_VALUES,
      COMPLETE_VALUES,
    ]);

    await backfillMasterDataFromWorkItems(harness.database as never);
    const firstEntryCounts = [...harness.entries.values()].map(
      (value) => value.usageCount,
    );
    const firstRelationCounts = [...harness.relations.values()].map(
      (value) => value.usageCount,
    );
    await backfillMasterDataFromWorkItems(harness.database as never);

    expect(harness.entries).toHaveLength(6);
    expect(harness.relations).toHaveLength(4);
    expect([...harness.entries.values()].map((value) => value.usageCount)).toEqual(
      firstEntryCounts,
    );
    expect(
      [...harness.relations.values()].map((value) => value.usageCount),
    ).toEqual(firstRelationCounts);
  });

  it('boş ve placeholder alanları atlar', async () => {
    const harness = createBackfillDatabase([
      {
        ...COMPLETE_VALUES,
        packagingType: null,
        supplierCompany: '?',
        orderType: 'N/A',
        processStage: null,
      },
    ]);

    const result = await backfillMasterDataFromWorkItems(
      harness.database as never,
    );

    expect(result.entriesSeen).toBe(2);
    expect(result.relationsSeen).toBe(1);
  });

  it('yalnız sembolden oluşan alanları DB insert listesinin dışında bırakır', async () => {
    const harness = createBackfillDatabase([
      {
        ...COMPLETE_VALUES,
        packagingType: '+',
        supplierCompany: '%',
        orderType: '🟠',
        processStage: '***',
      },
    ]);

    const result = await backfillMasterDataFromWorkItems(
      harness.database as never,
    );

    expect(result.entriesSeen).toBe(2);
    expect(result.relationsSeen).toBe(1);
    expect(
      [...harness.entries.values()].some((value) =>
        ['+', '%', '🟠', '***'].includes(value.displayValue),
      ),
    ).toBe(false);
  });

  it('work-item limitleri içindeki uzun serbest değerleri backfill eder', async () => {
    const packagingType = 'K'.repeat(81);
    const orderType = 'S'.repeat(31);
    const harness = createBackfillDatabase([
      { ...COMPLETE_VALUES, packagingType, orderType },
    ]);

    await backfillMasterDataFromWorkItems(harness.database as never);

    expect(
      harness.entries.has(`packaging_type\u0000${packagingType.toLowerCase()}`),
    ).toBe(true);
    expect(
      harness.entries.has(`order_type\u0000${orderType.toLowerCase()}`),
    ).toBe(true);
  });
});
