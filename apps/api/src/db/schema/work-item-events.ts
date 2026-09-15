import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { workItems } from './work-items.js';

export const workItemEvents = pgTable(
  'work_item_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workItemId: uuid('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    eventType: varchar('event_type', { length: 30 }).notNull(),
    fromModuleKey: varchar('from_module_key', { length: 50 }),
    toModuleKey: varchar('to_module_key', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'work_item_events_event_type_check',
      sql`${table.eventType} in ('moved', 'completed', 'reopened')`,
    ),
    check(
      'work_item_events_from_module_key_check',
      sql`${table.fromModuleKey} is null or ${table.fromModuleKey} in ('incoming-orders', 'new-designs', 'revisions', 'team-approval', 'customer-approval-mail', 'pricing', 'digital')`,
    ),
    check(
      'work_item_events_to_module_key_check',
      sql`${table.toModuleKey} is null or ${table.toModuleKey} in ('incoming-orders', 'new-designs', 'revisions', 'team-approval', 'customer-approval-mail', 'pricing', 'digital')`,
    ),
    check(
      'work_item_events_shape_check',
      sql`(${table.eventType} = 'moved' and ${table.fromModuleKey} is not null and ${table.toModuleKey} is not null and ${table.fromModuleKey} <> ${table.toModuleKey}) or (${table.eventType} in ('completed', 'reopened') and ${table.fromModuleKey} is null and ${table.toModuleKey} is null)`,
    ),
    index('work_item_events_work_item_id_created_at_idx').on(
      table.workItemId,
      table.createdAt,
    ),
    index('work_item_events_actor_id_idx').on(table.actorId),
  ],
);
