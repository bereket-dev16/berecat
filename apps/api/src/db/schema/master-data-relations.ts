import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { masterDataEntries } from './master-data-entries.js';

export const masterDataRelations = pgTable(
  'master_data_relations',
  {
    relationType: varchar('relation_type', { length: 50 }).notNull(),
    fromEntryId: uuid('from_entry_id')
      .notNull()
      .references(() => masterDataEntries.id, { onDelete: 'cascade' }),
    toEntryId: uuid('to_entry_id')
      .notNull()
      .references(() => masterDataEntries.id, { onDelete: 'cascade' }),
    usageCount: integer('usage_count').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.relationType, table.fromEntryId, table.toEntryId],
    }),
    check(
      'master_data_relations_relation_type_check',
      sql`${table.relationType} in ('company_product', 'product_packaging_type', 'packaging_type_supplier', 'packaging_type_order_type')`,
    ),
    check(
      'master_data_relations_distinct_entries_check',
      sql`${table.fromEntryId} <> ${table.toEntryId}`,
    ),
    check(
      'master_data_relations_usage_count_check',
      sql`${table.usageCount} >= 0`,
    ),
    index('master_data_relations_type_from_idx').on(
      table.relationType,
      table.fromEntryId,
    ),
    index('master_data_relations_type_to_idx').on(
      table.relationType,
      table.toEntryId,
    ),
    index('master_data_relations_type_usage_count_idx').on(
      table.relationType,
      table.usageCount,
    ),
  ],
);
