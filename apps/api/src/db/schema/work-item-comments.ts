import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { workItems } from './work-items.js';

export const workItemComments = pgTable(
  'work_item_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workItemId: uuid('work_item_id')
      .notNull()
      .references(() => workItems.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    parentCommentId: uuid('parent_comment_id'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'work_item_comments_body_trimmed_check',
      sql`${table.body} = btrim(${table.body})`,
    ),
    check(
      'work_item_comments_body_length_check',
      sql`char_length(${table.body}) between 1 and 2000`,
    ),
    check(
      'work_item_comments_not_self_parent_check',
      sql`${table.parentCommentId} is null or ${table.parentCommentId} <> ${table.id}`,
    ),
    foreignKey({
      columns: [table.parentCommentId],
      foreignColumns: [table.id],
      name: 'work_item_comments_parent_comment_id_fkey',
    }).onDelete('cascade'),
    index('work_item_comments_work_item_id_created_at_idx').on(
      table.workItemId,
      table.createdAt,
    ),
    index('work_item_comments_author_id_idx').on(table.authorId),
    index('work_item_comments_parent_comment_id_idx').on(
      table.parentCommentId,
    ),
  ],
);
