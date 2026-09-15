import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { workItems } from './work-items.js';

export const workItemAssignees = pgTable(
  'work_item_assignees',
  {
    workItemId: uuid('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workItemId, table.userId] }),
    index('work_item_assignees_user_id_idx').on(table.userId),
    index('work_item_assignees_assigned_by_idx').on(table.assignedBy),
  ],
);
