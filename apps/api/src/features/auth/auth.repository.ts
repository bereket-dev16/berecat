import { and, eq, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from '../../db/schema/index.js';
import { authSessions, users } from '../../db/schema/index.js';
import type {
  AuthRepository,
  NewSession,
  NewUser,
  PublicUser,
  StoredUser,
  UserCreationRepository,
  UserRole,
  UserTeam,
} from './auth.types.js';

type AuthDatabase = NodePgDatabase<typeof schema>;

function isUserRole(role: string): role is UserRole {
  return role === 'admin' || role === 'member';
}

function isUserTeam(team: string): team is UserTeam {
  return team === 'graphic' || team === 'digital';
}

function toPublicUser(row: {
  id: string;
  username: string;
  displayName: string;
  role: string;
  team: string;
}): PublicUser {
  if (!isUserRole(row.role) || !isUserTeam(row.team)) {
    throw new Error('Kullanıcı kaydı geçersiz.');
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    team: row.team,
  };
}

export interface DatabaseAuthRepository
  extends AuthRepository,
    UserCreationRepository {}

export function createAuthRepository(
  database: AuthDatabase,
): DatabaseAuthRepository {
  return {
    async findUserByUsername(username: string): Promise<StoredUser | null> {
      const [row] = await database
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          passwordHash: users.passwordHash,
          role: users.role,
          team: users.team,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        ...toPublicUser(row),
        passwordHash: row.passwordHash,
        isActive: row.isActive,
      };
    },

    async createSession(session: NewSession): Promise<void> {
      await database.insert(authSessions).values(session);
    },

    async findActiveUserBySessionTokenHash(
      tokenHash: string,
      now: Date,
    ): Promise<PublicUser | null> {
      const [row] = await database
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          team: users.team,
        })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(
          and(
            eq(authSessions.tokenHash, tokenHash),
            gt(authSessions.expiresAt, now),
            eq(users.isActive, true),
          ),
        )
        .limit(1);

      return row ? toPublicUser(row) : null;
    },

    async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
      await database
        .delete(authSessions)
        .where(eq(authSessions.tokenHash, tokenHash));
    },

    async createUser(user: NewUser): Promise<boolean> {
      const insertedUsers = await database
        .insert(users)
        .values(user)
        .onConflictDoNothing({ target: users.username })
        .returning({ id: users.id });

      return insertedUsers.length === 1;
    },
  };
}
