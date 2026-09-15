import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users.js';
import { workItemComments } from './work-item-comments.js';

export const workItemCommentReactions = pgTable(
  'work_item_comment_reactions',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => workItemComments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index('work_item_comment_reactions_user_id_idx').on(table.userId),
  ],
);
