import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const workItems = pgTable(
  'work_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    orderCode: varchar('order_code', { length: 100 }),
    companyName: varchar('company_name', { length: 200 }).notNull(),
    productName: varchar('product_name', { length: 250 }).notNull(),
    packagingType: varchar('packaging_type', { length: 150 }),
    supplierCompany: varchar('supplier_company', { length: 200 }),
    orderType: varchar('order_type', { length: 50 }),
    stockValue: varchar('stock_value', { length: 100 }),
    needOrderValue: varchar('need_order_value', { length: 100 }),
    orderedQuantity: varchar('ordered_quantity', { length: 100 }),
    receivedQuantity: varchar('received_quantity', { length: 100 }),
    orderReceivedDate: date('order_received_date'),
    orderPlacedDate: date('order_placed_date'),
    orderDeadlineDate: date('order_deadline_date'),
    orderShipmentDate: date('order_shipment_date'),
    processStage: varchar('process_stage', { length: 150 }),
    productDetail: text('product_detail'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => users.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'work_items_module_key_check',
      sql`${table.moduleKey} in ('incoming-orders', 'new-designs', 'revisions', 'team-approval', 'customer-approval-mail', 'pricing', 'digital')`,
    ),
    check(
      'work_items_company_name_trimmed_check',
      sql`${table.companyName} = btrim(${table.companyName})`,
    ),
    check(
      'work_items_company_name_not_empty_check',
      sql`char_length(${table.companyName}) > 0`,
    ),
    check(
      'work_items_product_name_trimmed_check',
      sql`${table.productName} = btrim(${table.productName})`,
    ),
    check(
      'work_items_product_name_not_empty_check',
      sql`char_length(${table.productName}) > 0`,
    ),
    check(
      'work_items_status_check',
      sql`${table.status} in ('active', 'completed')`,
    ),
    check(
      'work_items_completion_consistency_check',
      sql`(${table.status} = 'active' and ${table.completedAt} is null and ${table.completedBy} is null) or (${table.status} = 'completed' and ${table.completedAt} is not null and ${table.completedBy} is not null)`,
    ),
    check(
      'work_items_deletion_consistency_check',
      sql`(${table.deletedAt} is null and ${table.deletedBy} is null) or (${table.deletedAt} is not null and ${table.deletedBy} is not null)`,
    ),
    index('work_items_module_key_created_at_idx').on(
      table.moduleKey,
      table.createdAt,
    ),
    index('work_items_created_by_idx').on(table.createdBy),
    index('work_items_order_deadline_date_idx').on(table.orderDeadlineDate),
    index('work_items_status_module_key_created_at_idx').on(
      table.status,
      table.moduleKey,
      table.createdAt,
    ),
    index('work_items_status_completed_at_idx').on(
      table.status,
      table.completedAt,
    ),
    index('work_items_completed_by_idx').on(table.completedBy),
    index('work_items_deleted_at_idx').on(table.deletedAt),
    index('work_items_status_module_key_completed_at_idx').on(
      table.status,
      table.moduleKey,
      table.completedAt,
    ),
  ],
);
