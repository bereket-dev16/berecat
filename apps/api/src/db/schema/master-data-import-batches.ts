import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const masterDataImportBatches = pgTable(
  'master_data_import_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileSha256: varchar('file_sha256', { length: 64 })
      .notNull()
      .unique('master_data_import_batches_file_sha256_unique'),
    sourceFilename: text('source_filename').notNull(),
    totalRows: integer('total_rows').notNull(),
    acceptedValues: integer('accepted_values').notNull(),
    skippedValues: integer('skipped_values').notNull(),
    suspiciousValues: integer('suspicious_values').notNull(),
    insertedEntries: integer('inserted_entries').notNull(),
    updatedEntries: integer('updated_entries').notNull(),
    insertedRelations: integer('inserted_relations').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    summary: jsonb('summary').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'master_data_import_batches_file_sha256_check',
      sql`char_length(${table.fileSha256}) = 64`,
    ),
    check(
      'master_data_import_batches_counts_check',
      sql`${table.totalRows} >= 0 and ${table.acceptedValues} >= 0 and ${table.skippedValues} >= 0 and ${table.suspiciousValues} >= 0 and ${table.insertedEntries} >= 0 and ${table.updatedEntries} >= 0 and ${table.insertedRelations} >= 0`,
    ),
    check(
      'master_data_import_batches_status_check',
      sql`${table.status} = 'applied'`,
    ),
  ],
);
