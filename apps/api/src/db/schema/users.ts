import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 50 })
      .notNull()
      .unique('users_username_unique'),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    team: text('team').notNull(),
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
      'users_username_normalized_check',
      sql`${table.username} = lower(btrim(${table.username}))`,
    ),
    check(
      'users_username_not_empty_check',
      sql`char_length(${table.username}) > 0`,
    ),
    check('users_role_check', sql`${table.role} in ('admin', 'member')`),
    check('users_team_check', sql`${table.team} in ('graphic', 'digital')`),
  ],
);
