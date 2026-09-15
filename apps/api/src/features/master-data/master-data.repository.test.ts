import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
  masterDataEntries,
  masterDataRelations,
} from '../../db/schema/index.js';
import {
  createMasterDataRepository,
  syncWorkItemMasterData,
} from './master-data.repository.js';
import type {
  MasterDataWorkItemValues,
  NormalizedMasterDataSuggestionQuery,
} from './master-data.types.js';

interface SuggestionQueryCapture {
  selectCount: number;
  fromTable?: unknown;
  leftJoins: Array<{ table: unknown; condition: unknown }>;
  where?: unknown;
  orderBy: unknown[];
  limit?: number;
}

function createSuggestionQueryDatabase() {
  const capture: SuggestionQueryCapture = {
    selectCount: 0,
    leftJoins: [],
    orderBy: [],
  };
  const builder = {
    from(table: unknown) {
      capture.fromTable = table;
      return builder;
    },
    leftJoin(table: unknown, condition: unknown) {
      capture.leftJoins.push({ table, condition });
      return builder;
    },
    where(condition: unknown) {
      capture.where = condition;
      return builder;
    },
    orderBy(...expressions: unknown[]) {
      capture.orderBy = expressions;
      return builder;
    },
    async limit(value: number) {
      capture.limit = value;
      return [];
    },
  };
  const database = {
    select() {
      capture.selectCount += 1;
      return builder;
    },
  };

  return { database, capture };
}

const queryDialect = new PgDialect();

function compileCapturedSql(expression: unknown): {
  sql: string;
  params: unknown[];
} {
  const compiled = queryDialect.sqlToQuery(expression as never);
  return { sql: compiled.sql, params: compiled.params };
}

const PRODUCT_QUERY: NormalizedMasterDataSuggestionQuery = {
  kind: 'product',
  q: {
    displayValue: 'Ürün',
    normalizedKey: 'urun',
    searchValue: 'urun',
  },
  limit: 7,
  context: null,
};

interface StoredEntry {
  id: string;
  kind: string;
  normalizedKey: string;
  displayValue: string;
  source: string;
  usageCount: number;
}

interface StoredRelation {
  relationType: string;
  fromEntryId: string;
  toEntryId: string;
  usageCount: number;
}

function createSyncDatabase() {
  const entries = new Map<string, StoredEntry>();
  const relations = new Map<string, StoredRelation>();
  let entrySequence = 1;
  let lastConflictEntry: StoredEntry | undefined;

  function entryKey(value: { kind: string; normalizedKey: string }): string {
    return `${value.kind}\u0000${value.normalizedKey}`;
  }

  function relationKey(value: {
    relationType: string;
    fromEntryId: string;
    toEntryId: string;
  }): string {
    return `${value.relationType}\u0000${value.fromEntryId}\u0000${value.toEntryId}`;
  }

  function insertEntry(
    value: Omit<StoredEntry, 'id'>,
    updateExisting: boolean,
  ): StoredEntry | null {
    const key = entryKey(value);
    const existing = entries.get(key);

    if (existing) {
      lastConflictEntry = existing;

      if (updateExisting) {
        existing.usageCount += 1;
        return existing;
      }

      return null;
    }

    const created = {
      ...value,
      id: `00000000-0000-4000-8000-${String(entrySequence).padStart(12, '0')}`,
    };
    entrySequence += 1;
    entries.set(key, created);
    lastConflictEntry = undefined;
    return created;
  }

  const database = {
    insert(table: unknown) {
      return {
        values(value: Record<string, unknown>) {
          if (table === masterDataEntries) {
            const entryValue = value as unknown as Omit<StoredEntry, 'id'>;

            return {
              onConflictDoUpdate() {
                const result = insertEntry(entryValue, true);
                return {
                  async returning() {
                    return result ? [{ id: result.id }] : [];
                  },
                };
              },
              onConflictDoNothing() {
                const result = insertEntry(entryValue, false);
                return {
                  async returning() {
                    return result ? [{ id: result.id }] : [];
                  },
                };
              },
            };
          }

          if (table !== masterDataRelations) {
            throw new Error('Beklenmeyen sentetik tablo.');
          }

          const relationValue = value as unknown as StoredRelation;

          return {
            async onConflictDoUpdate() {
              const key = relationKey(relationValue);
              const existing = relations.get(key);

              if (existing) {
                existing.usageCount += 1;
              } else {
                relations.set(key, { ...relationValue });
              }
            },
            async onConflictDoNothing() {
              const key = relationKey(relationValue);

              if (!relations.has(key)) {
                relations.set(key, { ...relationValue });
              }
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit() {
                  return lastConflictEntry
                    ? [{ id: lastConflictEntry.id }]
                    : [];
                },
              };
            },
          };
        },
      };
    },
  };

  return { database, entries, relations };
}

const ALL_VALUES: MasterDataWorkItemValues = {
  companyName: 'Sentetik Firma',
  productName: 'Sentetik Ürün',
  packagingType: 'Etiket',
  supplierCompany: 'Sentetik Matbaa',
  orderType: 'Adet',
  processStage: 'Tasarım',
};

describe('master data suggestion repository sorgusu', () => {
  it('bağlamsız aramada active/kind/contains filtresini ve rank sırasını tek sorguda uygular', async () => {
    const harness = createSuggestionQueryDatabase();
    const repository = createMasterDataRepository(harness.database as never);

    await expect(repository.listSuggestions(PRODUCT_QUERY)).resolves.toEqual(
      [],
    );

    expect(harness.capture.selectCount).toBe(1);
    expect(harness.capture.fromTable).toBe(masterDataEntries);
    expect(harness.capture.leftJoins).toHaveLength(0);
    expect(harness.capture.limit).toBe(7);

    const where = compileCapturedSql(harness.capture.where);
    expect(where.sql).toContain('"master_data_entries"."kind" =');
    expect(where.sql).toContain('"master_data_entries"."is_active" =');
    expect(where.sql).toContain('"master_data_entries"."search_value" like');
    expect(where.params).toEqual(['product', true, '%urun%']);

    const order = harness.capture.orderBy.map(compileCapturedSql);
    expect(order).toHaveLength(5);
    expect(order[0]?.sql).toContain('"normalized_key"');
    expect(order[1]?.sql).toContain('"search_value" like');
    expect(order[2]?.sql).toContain('"search_value" like');
    expect(order[3]?.sql).toContain('"usage_count" desc');
    expect(order[4]?.sql).toContain('"display_value" asc');
    expect(order[0]?.params).toEqual(['urun']);
    expect(order[1]?.params).toEqual(['urun%']);
    expect(order[2]?.params).toEqual(['% urun%']);
  });

  it('bağlamlı aramada global sonuçları koruyan left join ve context rank sırasını kullanır', async () => {
    const harness = createSuggestionQueryDatabase();
    const repository = createMasterDataRepository(harness.database as never);
    const query: NormalizedMasterDataSuggestionQuery = {
      ...PRODUCT_QUERY,
      context: {
        relationType: 'company_product',
        contextKind: 'company',
        contextNormalizedKey: 'firma a',
        candidateDirection: 'to',
      },
    };

    await repository.listSuggestions(query);

    expect(harness.capture.selectCount).toBe(1);
    expect(harness.capture.leftJoins).toHaveLength(2);
    const contextJoin = compileCapturedSql(
      harness.capture.leftJoins[0]?.condition,
    );
    const relationJoin = compileCapturedSql(
      harness.capture.leftJoins[1]?.condition,
    );
    expect(contextJoin.sql).toContain('"master_data_context_entry"."kind" =');
    expect(contextJoin.sql).toContain(
      '"master_data_context_entry"."normalized_key" =',
    );
    expect(contextJoin.sql).toContain(
      '"master_data_context_entry"."is_active" =',
    );
    expect(contextJoin.params).toEqual(['company', 'firma a', true]);
    expect(relationJoin.sql).toContain(
      '"master_data_relations"."relation_type" =',
    );
    expect(relationJoin.sql).toContain(
      '"master_data_relations"."to_entry_id" = "master_data_entries"."id"',
    );
    expect(relationJoin.sql).toContain(
      '"master_data_relations"."from_entry_id" = "master_data_context_entry"."id"',
    );
    expect(relationJoin.params).toEqual(['company_product']);

    const order = harness.capture.orderBy.map(compileCapturedSql);
    expect(order).toHaveLength(7);
    expect(order[0]?.sql).toContain('"normalized_key"');
    expect(order[1]?.sql).toContain('"relation_type" is not null');
    expect(order[2]?.sql).toContain('"search_value" like');
    expect(order[3]?.sql).toContain('"search_value" like');
    expect(order[4]?.sql).toContain(
      '"master_data_relations"."usage_count" desc',
    );
    expect(order[5]?.sql).toContain(
      '"master_data_entries"."usage_count" desc',
    );
    expect(order[6]?.sql).toContain(
      '"master_data_entries"."display_value" asc',
    );
  });

  it('boş aramada contains koşulu eklemez ve limitli tek sorgu çalıştırır', async () => {
    const harness = createSuggestionQueryDatabase();
    const repository = createMasterDataRepository(harness.database as never);

    await repository.listSuggestions({
      ...PRODUCT_QUERY,
      q: null,
      limit: 20,
    });

    expect(harness.capture.selectCount).toBe(1);
    expect(harness.capture.limit).toBe(20);
    const where = compileCapturedSql(harness.capture.where);
    expect(where.sql).not.toContain('"search_value" like');
    expect(where.params).toEqual(['product', true]);
    const order = harness.capture.orderBy.map(compileCapturedSql);
    expect(order).toHaveLength(2);
    expect(order[0]?.sql).toContain('"usage_count" desc');
    expect(order[1]?.sql).toContain('"display_value" asc');
    expect(order.map((value) => value.sql).join(' ')).not.toContain('0 desc');
  });

  it('boş bağlamlı aramada yalnız context ve kullanım ranklarını sıralar', async () => {
    const harness = createSuggestionQueryDatabase();
    const repository = createMasterDataRepository(harness.database as never);

    await repository.listSuggestions({
      ...PRODUCT_QUERY,
      q: null,
      context: {
        relationType: 'company_product',
        contextKind: 'company',
        contextNormalizedKey: 'firma a',
        candidateDirection: 'to',
      },
    });

    const order = harness.capture.orderBy.map(compileCapturedSql);
    expect(order).toHaveLength(4);
    expect(order[0]?.sql).toContain('"relation_type" is not null');
    expect(order[1]?.sql).toContain(
      '"master_data_relations"."usage_count" desc',
    );
    expect(order[2]?.sql).toContain(
      '"master_data_entries"."usage_count" desc',
    );
    expect(order[3]?.sql).toContain(
      '"master_data_entries"."display_value" asc',
    );
    expect(order.map((value) => value.sql).join(' ')).not.toContain('0 desc');
  });
});

describe('work item master data senkronizasyonu', () => {
  it('create için altı entry ve dört relation oluşturur', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(harness.database as never, ALL_VALUES);

    expect(harness.entries).toHaveLength(6);
    expect(harness.relations).toHaveLength(4);
    expect([...harness.entries.values()].every((value) => value.usageCount === 1)).toBe(true);
  });

  it('aynı değer tekrar kullanıldığında duplicate entry oluşturmaz', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(harness.database as never, ALL_VALUES);
    await syncWorkItemMasterData(harness.database as never, ALL_VALUES);

    expect(harness.entries).toHaveLength(6);
    expect([...harness.entries.values()].every((value) => value.usageCount === 2)).toBe(true);
  });

  it('create tekrarında relation kullanım sayılarını artırır', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(harness.database as never, ALL_VALUES);
    await syncWorkItemMasterData(harness.database as never, ALL_VALUES);

    expect(harness.relations).toHaveLength(4);
    expect([...harness.relations.values()].every((value) => value.usageCount === 2)).toBe(true);
  });

  it('edit sırasında normalized değeri değişmeyen entry kullanımını artırmaz', async () => {
    const harness = createSyncDatabase();
    await syncWorkItemMasterData(harness.database as never, ALL_VALUES);

    await syncWorkItemMasterData(
      harness.database as never,
      { ...ALL_VALUES, productName: 'SENTETİK   ÜRÜN' },
      ALL_VALUES,
    );

    expect(harness.entries).toHaveLength(6);
    expect([...harness.entries.values()].every((value) => value.usageCount === 1)).toBe(true);
    expect([...harness.relations.values()].every((value) => value.usageCount === 1)).toBe(true);
  });

  it('edit sırasında yeni değeri upsert eder ve yeni relation oluşturur', async () => {
    const harness = createSyncDatabase();
    await syncWorkItemMasterData(harness.database as never, ALL_VALUES);
    const changed = { ...ALL_VALUES, productName: 'İkinci Sentetik Ürün' };

    await syncWorkItemMasterData(
      harness.database as never,
      changed,
      ALL_VALUES,
    );

    expect(harness.entries).toHaveLength(7);
    expect(
      [...harness.entries.values()].find(
        (value) => value.normalizedKey === 'ikinci sentetik urun',
      )?.usageCount,
    ).toBe(1);
    expect(
      [...harness.relations.values()].filter(
        (value) => value.relationType === 'company_product',
      ),
    ).toHaveLength(2);
  });

  it('legacy unchanged değer ilk kez görülüyorsa entry ve relation ekler', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(
      harness.database as never,
      ALL_VALUES,
      ALL_VALUES,
    );

    expect(harness.entries).toHaveLength(6);
    expect(harness.relations).toHaveLength(4);
    expect([...harness.entries.values()].every((value) => value.usageCount === 1)).toBe(true);
  });

  it('boş optional değerler için entry veya relation üretmez', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(harness.database as never, {
      ...ALL_VALUES,
      packagingType: null,
      supplierCompany: null,
      orderType: null,
      processStage: null,
    });

    expect(harness.entries).toHaveLength(2);
    expect(harness.relations).toHaveLength(1);
  });

  it('placeholder değerleri master data’ya yazmaz', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(harness.database as never, {
      ...ALL_VALUES,
      packagingType: '?',
      supplierCompany: 'N/A',
      orderType: '-',
      processStage: 'undefined',
    });

    expect(harness.entries).toHaveLength(2);
    expect(harness.relations).toHaveLength(1);
  });

  it('yalnız sembolden oluşan değerleri master data’ya yazmaz', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(harness.database as never, {
      ...ALL_VALUES,
      packagingType: '+',
      supplierCompany: '%',
      orderType: '🟠',
      processStage: '***',
    });

    expect(harness.entries).toHaveLength(2);
    expect(harness.relations).toHaveLength(1);
  });

  it('work-item limitleri içindeki uzun serbest değerleri runtime sync eder', async () => {
    const harness = createSyncDatabase();
    const packagingType = 'K'.repeat(81);
    const orderType = 'S'.repeat(31);

    await syncWorkItemMasterData(harness.database as never, {
      ...ALL_VALUES,
      packagingType,
      orderType,
    });

    expect(
      harness.entries.has(`packaging_type\u0000${packagingType.toLowerCase()}`),
    ).toBe(true);
    expect(
      harness.entries.has(`order_type\u0000${orderType.toLowerCase()}`),
    ).toBe(true);
  });

  it('source alanını ilk oluşturma kaynağı olarak korur', async () => {
    const harness = createSyncDatabase();

    await syncWorkItemMasterData(
      harness.database as never,
      ALL_VALUES,
      undefined,
      'user',
    );
    await syncWorkItemMasterData(
      harness.database as never,
      ALL_VALUES,
      undefined,
      'backfill',
    );

    expect([...harness.entries.values()].every((value) => value.source === 'user')).toBe(true);
  });
});
