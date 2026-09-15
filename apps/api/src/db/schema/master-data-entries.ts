import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const masterDataEntries = pgTable(
  'master_data_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: varchar('kind', { length: 40 }).notNull(),
    displayValue: text('display_value').notNull(),
    normalizedKey: text('normalized_key').notNull(),
    searchValue: text('search_value').notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'master_data_entries_kind_check',
      sql`${table.kind} in ('company', 'product', 'packaging_type', 'supplier', 'order_type', 'process_stage')`,
    ),
    check(
      'master_data_entries_source_check',
      sql`${table.source} in ('csv', 'user', 'backfill')`,
    ),
    check(
      'master_data_entries_display_value_trimmed_check',
      sql`${table.displayValue} = btrim(${table.displayValue})`,
    ),
    check(
      'master_data_entries_display_value_not_empty_check',
      sql`char_length(${table.displayValue}) > 0`,
    ),
    check(
      'master_data_entries_normalized_key_not_empty_check',
      sql`char_length(${table.normalizedKey}) > 0`,
    ),
    check(
      'master_data_entries_search_value_not_empty_check',
      sql`char_length(${table.searchValue}) > 0`,
    ),
    check(
      'master_data_entries_usage_count_check',
      sql`${table.usageCount} >= 0`,
    ),
    unique('master_data_entries_kind_normalized_key_unique').on(
      table.kind,
      table.normalizedKey,
    ),
    index('master_data_entries_kind_is_active_idx').on(
      table.kind,
      table.isActive,
    ),
    index('master_data_entries_kind_normalized_key_idx').on(
      table.kind,
      table.normalizedKey,
    ),
    index('master_data_entries_kind_search_value_prefix_idx').using(
      'btree',
      table.kind,
      table.searchValue.asc().op('text_pattern_ops'),
    ),
    index('master_data_entries_kind_usage_count_idx').on(
      table.kind,
      table.usageCount,
    ),
  ],
);
