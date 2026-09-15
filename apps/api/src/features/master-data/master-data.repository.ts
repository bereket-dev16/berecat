import {
  and,
  asc,
  desc,
  eq,
  like,
  sql,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { alias } from 'drizzle-orm/pg-core';

import * as schema from '../../db/schema/index.js';
import {
  masterDataEntries,
  masterDataRelations,
} from '../../db/schema/index.js';
import type {
  MasterDataKind,
  MasterDataRelationType,
  MasterDataSource,
} from './master-data.constants.js';
import {
  areSameMasterDataValues,
  isMasterDataPlaceholder,
  isMasterDataValueOverlength,
  normalizeMasterDataValue,
} from './master-data.normalization.js';
import type {
  MasterDataRepository,
  MasterDataSuggestion,
  MasterDataWorkItemValues,
  NormalizedMasterDataSuggestionQuery,
  NormalizedMasterDataValue,
} from './master-data.types.js';

type MasterDataDatabase = NodePgDatabase<typeof schema>;

export type MasterDataWriteDatabase = Pick<
  MasterDataDatabase,
  'insert' | 'select'
>;

interface WorkItemEntryDefinition {
  field: keyof MasterDataWorkItemValues;
  kind: MasterDataKind;
}

interface WorkItemRelationDefinition {
  relationType: MasterDataRelationType;
  fromField: keyof MasterDataWorkItemValues;
  fromKind: MasterDataKind;
  toField: keyof MasterDataWorkItemValues;
  toKind: MasterDataKind;
}

const WORK_ITEM_ENTRY_DEFINITIONS: readonly WorkItemEntryDefinition[] = [
  { field: 'companyName', kind: 'company' },
  { field: 'productName', kind: 'product' },
  { field: 'packagingType', kind: 'packaging_type' },
  { field: 'supplierCompany', kind: 'supplier' },
  { field: 'orderType', kind: 'order_type' },
  { field: 'processStage', kind: 'process_stage' },
];

const WORK_ITEM_RELATION_DEFINITIONS: readonly WorkItemRelationDefinition[] = [
  {
    relationType: 'company_product',
    fromField: 'companyName',
    fromKind: 'company',
    toField: 'productName',
    toKind: 'product',
  },
  {
    relationType: 'product_packaging_type',
    fromField: 'productName',
    fromKind: 'product',
    toField: 'packagingType',
    toKind: 'packaging_type',
  },
  {
    relationType: 'packaging_type_supplier',
    fromField: 'packagingType',
    fromKind: 'packaging_type',
    toField: 'supplierCompany',
    toKind: 'supplier',
  },
  {
    relationType: 'packaging_type_order_type',
    fromField: 'packagingType',
    fromKind: 'packaging_type',
    toField: 'orderType',
    toKind: 'order_type',
  },
];

function normalizeUsableWorkItemValue(
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

  const value = normalizeMasterDataValue(rawValue);
  return value.normalizedKey && value.searchValue ? value : null;
}

async function ensureWorkItemEntry(
  database: MasterDataWriteDatabase,
  kind: MasterDataKind,
  value: NormalizedMasterDataValue,
  source: MasterDataSource,
  incrementExisting: boolean,
  now: Date,
): Promise<string> {
  const insertQuery = database
    .insert(masterDataEntries)
    .values({
      kind,
      displayValue: value.displayValue,
      normalizedKey: value.normalizedKey,
      searchValue: value.searchValue,
      source,
      usageCount: 1,
      lastUsedAt: now,
      updatedAt: now,
    });

  const rows = incrementExisting
    ? await insertQuery
        .onConflictDoUpdate({
          target: [masterDataEntries.kind, masterDataEntries.normalizedKey],
          set: {
            usageCount: sql`${masterDataEntries.usageCount} + 1`,
            lastUsedAt: now,
            updatedAt: now,
          },
        })
        .returning({ id: masterDataEntries.id })
    : await insertQuery
        .onConflictDoNothing({
          target: [masterDataEntries.kind, masterDataEntries.normalizedKey],
        })
        .returning({ id: masterDataEntries.id });

  if (rows[0]) {
    return rows[0].id;
  }

  const [existing] = await database
    .select({ id: masterDataEntries.id })
    .from(masterDataEntries)
    .where(
      and(
        eq(masterDataEntries.kind, kind),
        eq(masterDataEntries.normalizedKey, value.normalizedKey),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error('Ana veri kaydı oluşturulamadı.');
  }

  return existing.id;
}

function relationValueChanged(
  definition: WorkItemRelationDefinition,
  current: MasterDataWorkItemValues,
  previous: MasterDataWorkItemValues | undefined,
): boolean {
  if (!previous) {
    return true;
  }

  return !(
    areSameMasterDataValues(
      current[definition.fromField],
      previous[definition.fromField],
    ) &&
    areSameMasterDataValues(
      current[definition.toField],
      previous[definition.toField],
    )
  );
}

/**
 * Work item create/edit transaction clientıyla çağrılır. Böylece iş, atamalar ve
 * ana veri kullanım sayaçları aynı commit/rollback sınırında kalır.
 */
export async function syncWorkItemMasterData(
  database: MasterDataWriteDatabase,
  values: MasterDataWorkItemValues,
  previousValues?: MasterDataWorkItemValues,
  source: MasterDataSource = 'user',
): Promise<void> {
  const now = new Date();
  const entryIds = new Map<MasterDataKind, string>();

  for (const definition of WORK_ITEM_ENTRY_DEFINITIONS) {
    const rawValue = values[definition.field];
    const normalizedValue = normalizeUsableWorkItemValue(
      definition.kind,
      rawValue,
    );

    if (!normalizedValue) {
      continue;
    }

    const changed = previousValues
      ? !areSameMasterDataValues(rawValue, previousValues[definition.field])
      : true;
    const entryId = await ensureWorkItemEntry(
      database,
      definition.kind,
      normalizedValue,
      source,
      changed,
      now,
    );
    entryIds.set(definition.kind, entryId);
  }

  for (const definition of WORK_ITEM_RELATION_DEFINITIONS) {
    const fromEntryId = entryIds.get(definition.fromKind);
    const toEntryId = entryIds.get(definition.toKind);

    if (!fromEntryId || !toEntryId) {
      continue;
    }

    const insertQuery = database.insert(masterDataRelations).values({
      relationType: definition.relationType,
      fromEntryId,
      toEntryId,
      usageCount: 1,
      lastUsedAt: now,
      updatedAt: now,
    });

    if (relationValueChanged(definition, values, previousValues)) {
      await insertQuery.onConflictDoUpdate({
        target: [
          masterDataRelations.relationType,
          masterDataRelations.fromEntryId,
          masterDataRelations.toEntryId,
        ],
        set: {
          usageCount: sql`${masterDataRelations.usageCount} + 1`,
          lastUsedAt: now,
          updatedAt: now,
        },
      });
    } else {
      await insertQuery.onConflictDoNothing({
        target: [
          masterDataRelations.relationType,
          masterDataRelations.fromEntryId,
          masterDataRelations.toEntryId,
        ],
      });
    }
  }
}

function mapSuggestionRows(
  rows: Array<{ id: string; kind: string; value: string }>,
  expectedKind: MasterDataKind,
): MasterDataSuggestion[] {
  return rows.map((row) => {
    if (row.kind !== expectedKind) {
      throw new Error('Ana veri türü geçersiz.');
    }

    return { id: row.id, kind: expectedKind, value: row.value };
  });
}

export function createMasterDataRepository(
  database: MasterDataDatabase,
): MasterDataRepository {
  return {
    async listSuggestions(query: NormalizedMasterDataSuggestionQuery) {
      const contextEntry = alias(masterDataEntries, 'master_data_context_entry');
      const exactRank = query.q
        ? sql<number>`case when ${masterDataEntries.normalizedKey} = ${query.q.normalizedKey} then 1 else 0 end`
        : sql<number>`0`;
      const prefixRank = query.q
        ? sql<number>`case when ${masterDataEntries.searchValue} like ${`${query.q.searchValue}%`} then 1 else 0 end`
        : sql<number>`0`;
      const wordPrefixRank = query.q
        ? sql<number>`case when ${masterDataEntries.searchValue} like ${`% ${query.q.searchValue}%`} then 1 else 0 end`
        : sql<number>`0`;
      const baseCondition = and(
        eq(masterDataEntries.kind, query.kind),
        eq(masterDataEntries.isActive, true),
        query.q
          ? like(
              masterDataEntries.searchValue,
              `%${query.q.searchValue}%`,
            )
          : undefined,
      );

      if (!query.context) {
        const orderExpressions = query.q
          ? [
              desc(exactRank),
              desc(prefixRank),
              desc(wordPrefixRank),
              desc(masterDataEntries.usageCount),
              asc(masterDataEntries.displayValue),
            ]
          : [
              desc(masterDataEntries.usageCount),
              asc(masterDataEntries.displayValue),
            ];
        const rows = await database
          .select({
            id: masterDataEntries.id,
            kind: masterDataEntries.kind,
            value: masterDataEntries.displayValue,
          })
          .from(masterDataEntries)
          .where(baseCondition)
          .orderBy(...orderExpressions)
          .limit(query.limit);

        return mapSuggestionRows(rows, query.kind);
      }

      const candidateRelationColumn =
        query.context.candidateDirection === 'to'
          ? masterDataRelations.toEntryId
          : masterDataRelations.fromEntryId;
      const contextRelationColumn =
        query.context.candidateDirection === 'to'
          ? masterDataRelations.fromEntryId
          : masterDataRelations.toEntryId;
      const contextRank = sql<number>`case when ${masterDataRelations.relationType} is not null then 1 else 0 end`;
      const orderExpressions = query.q
        ? [
            desc(exactRank),
            desc(contextRank),
            desc(prefixRank),
            desc(wordPrefixRank),
            desc(masterDataRelations.usageCount),
            desc(masterDataEntries.usageCount),
            asc(masterDataEntries.displayValue),
          ]
        : [
            desc(contextRank),
            desc(masterDataRelations.usageCount),
            desc(masterDataEntries.usageCount),
            asc(masterDataEntries.displayValue),
          ];
      const rows = await database
        .select({
          id: masterDataEntries.id,
          kind: masterDataEntries.kind,
          value: masterDataEntries.displayValue,
        })
        .from(masterDataEntries)
        .leftJoin(
          contextEntry,
          and(
            eq(contextEntry.kind, query.context.contextKind),
            eq(
              contextEntry.normalizedKey,
              query.context.contextNormalizedKey,
            ),
            eq(contextEntry.isActive, true),
          ),
        )
        .leftJoin(
          masterDataRelations,
          and(
            eq(
              masterDataRelations.relationType,
              query.context.relationType,
            ),
            eq(candidateRelationColumn, masterDataEntries.id),
            eq(contextRelationColumn, contextEntry.id),
          ),
        )
        .where(baseCondition)
        .orderBy(...orderExpressions)
        .limit(query.limit);

      return mapSuggestionRows(rows, query.kind);
    },
  };
}
