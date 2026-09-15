import { isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '../../db/schema/index.js';
import {
  masterDataEntries,
  masterDataRelations,
  workItems,
} from '../../db/schema/index.js';
import type {
  MasterDataKind,
  MasterDataRelationType,
} from './master-data.constants.js';
import {
  isMasterDataPlaceholder,
  isMasterDataValueOverlength,
  normalizeMasterDataValue,
} from './master-data.normalization.js';
import type {
  MasterDataBackfillResult,
  MasterDataWorkItemValues,
  NormalizedMasterDataValue,
} from './master-data.types.js';

type MasterDataDatabase = NodePgDatabase<typeof schema>;

interface AggregatedEntry extends NormalizedMasterDataValue {
  kind: MasterDataKind;
  usageCount: number;
}

interface AggregatedRelation {
  relationType: MasterDataRelationType;
  fromKind: MasterDataKind;
  fromNormalizedKey: string;
  toKind: MasterDataKind;
  toNormalizedKey: string;
  usageCount: number;
}

function entryKey(kind: MasterDataKind, normalizedKey: string): string {
  return `${kind}\u0000${normalizedKey}`;
}

function relationKey(
  relationType: MasterDataRelationType,
  fromNormalizedKey: string,
  toNormalizedKey: string,
): string {
  return `${relationType}\u0000${fromNormalizedKey}\u0000${toNormalizedKey}`;
}

function chunksOf<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function normalizeUsableValue(
  kind: MasterDataKind,
  rawValue: string | null,
): NormalizedMasterDataValue | null {
  if (
    !rawValue ||
    isMasterDataPlaceholder(rawValue) ||
    isMasterDataValueOverlength(kind, rawValue)
  ) {
    return null;
  }

  const normalized = normalizeMasterDataValue(rawValue);
  return normalized.normalizedKey && normalized.searchValue
    ? normalized
    : null;
}

function aggregateWorkItems(rows: MasterDataWorkItemValues[]): {
  entries: AggregatedEntry[];
  relations: AggregatedRelation[];
} {
  const entries = new Map<string, AggregatedEntry>();
  const relations = new Map<string, AggregatedRelation>();

  function addEntry(
    kind: MasterDataKind,
    rawValue: string | null,
  ): NormalizedMasterDataValue | null {
    const value = normalizeUsableValue(kind, rawValue);

    if (!value) {
      return null;
    }

    const key = entryKey(kind, value.normalizedKey);
    const existing = entries.get(key);

    if (existing) {
      existing.usageCount += 1;
    } else {
      entries.set(key, { kind, ...value, usageCount: 1 });
    }

    return value;
  }

  function addRelation(
    relationType: MasterDataRelationType,
    fromKind: MasterDataKind,
    fromValue: NormalizedMasterDataValue | null,
    toKind: MasterDataKind,
    toValue: NormalizedMasterDataValue | null,
  ): void {
    if (!fromValue || !toValue) {
      return;
    }

    const key = relationKey(
      relationType,
      fromValue.normalizedKey,
      toValue.normalizedKey,
    );
    const existing = relations.get(key);

    if (existing) {
      existing.usageCount += 1;
    } else {
      relations.set(key, {
        relationType,
        fromKind,
        fromNormalizedKey: fromValue.normalizedKey,
        toKind,
        toNormalizedKey: toValue.normalizedKey,
        usageCount: 1,
      });
    }
  }

  for (const row of rows) {
    const company = addEntry('company', row.companyName);
    const product = addEntry('product', row.productName);
    const packagingType = addEntry('packaging_type', row.packagingType);
    const supplier = addEntry('supplier', row.supplierCompany);
    const orderType = addEntry('order_type', row.orderType);
    addEntry('process_stage', row.processStage);
    addRelation('company_product', 'company', company, 'product', product);
    addRelation(
      'product_packaging_type',
      'product',
      product,
      'packaging_type',
      packagingType,
    );
    addRelation(
      'packaging_type_supplier',
      'packaging_type',
      packagingType,
      'supplier',
      supplier,
    );
    addRelation(
      'packaging_type_order_type',
      'packaging_type',
      packagingType,
      'order_type',
      orderType,
    );
  }

  return { entries: [...entries.values()], relations: [...relations.values()] };
}

export async function backfillMasterDataFromWorkItems(
  database: MasterDataDatabase,
): Promise<MasterDataBackfillResult> {
  return database.transaction(async (tx) => {
    const rows = await tx
      .select({
        companyName: workItems.companyName,
        productName: workItems.productName,
        packagingType: workItems.packagingType,
        supplierCompany: workItems.supplierCompany,
        orderType: workItems.orderType,
        processStage: workItems.processStage,
      })
      .from(workItems)
      .where(isNull(workItems.deletedAt));
    const aggregate = aggregateWorkItems(rows);
    const now = new Date();
    const entryIds = new Map<string, string>();

    for (const entryChunk of chunksOf(aggregate.entries, 250)) {
      if (entryChunk.length === 0) {
        continue;
      }

      const insertedRows = await tx
        .insert(masterDataEntries)
        .values(
          entryChunk.map((entry) => ({
            kind: entry.kind,
            displayValue: entry.displayValue,
            normalizedKey: entry.normalizedKey,
            searchValue: entry.searchValue,
            source: 'backfill' as const,
            usageCount: entry.usageCount,
            lastUsedAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [masterDataEntries.kind, masterDataEntries.normalizedKey],
          set: {
            usageCount: sql`greatest(${masterDataEntries.usageCount}, excluded.usage_count)`,
            lastUsedAt: sql`case when ${masterDataEntries.usageCount} < excluded.usage_count then ${now} else ${masterDataEntries.lastUsedAt} end`,
            updatedAt: sql`case when ${masterDataEntries.usageCount} < excluded.usage_count then ${now} else ${masterDataEntries.updatedAt} end`,
          },
        })
        .returning({
          id: masterDataEntries.id,
          kind: masterDataEntries.kind,
          normalizedKey: masterDataEntries.normalizedKey,
        });

      for (const row of insertedRows) {
        entryIds.set(
          entryKey(row.kind as MasterDataKind, row.normalizedKey),
          row.id,
        );
      }
    }

    const relationRows = aggregate.relations.map((relation) => {
      const fromEntryId = entryIds.get(
        entryKey(relation.fromKind, relation.fromNormalizedKey),
      );
      const toEntryId = entryIds.get(
        entryKey(relation.toKind, relation.toNormalizedKey),
      );

      if (!fromEntryId || !toEntryId) {
        throw new Error('Backfill ilişkisi için ana veri kaydı bulunamadı.');
      }

      return {
        relationType: relation.relationType,
        fromEntryId,
        toEntryId,
        usageCount: relation.usageCount,
      };
    });

    for (const relationChunk of chunksOf(relationRows, 250)) {
      if (relationChunk.length === 0) {
        continue;
      }

      await tx
        .insert(masterDataRelations)
        .values(
          relationChunk.map((relation) => ({
            ...relation,
            lastUsedAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [
            masterDataRelations.relationType,
            masterDataRelations.fromEntryId,
            masterDataRelations.toEntryId,
          ],
          set: {
            usageCount: sql`greatest(${masterDataRelations.usageCount}, excluded.usage_count)`,
            lastUsedAt: sql`case when ${masterDataRelations.usageCount} < excluded.usage_count then ${now} else ${masterDataRelations.lastUsedAt} end`,
            updatedAt: sql`case when ${masterDataRelations.usageCount} < excluded.usage_count then ${now} else ${masterDataRelations.updatedAt} end`,
          },
        });
    }

    return {
      processedWorkItems: rows.length,
      entriesSeen: aggregate.entries.length,
      relationsSeen: aggregate.relations.length,
    };
  });
}
