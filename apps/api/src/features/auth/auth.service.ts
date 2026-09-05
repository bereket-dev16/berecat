import { AUTH_SESSION_DURATION_MILLISECONDS } from './auth.constants.js';
import type {
  AuthRepository,
  AuthService,
  PublicUser,
} from './auth.types.js';
import { verifyPasswordWithFallback } from './password.js';
import {
  createSessionToken,
  hashSessionToken,
  isValidSessionToken,
} from './session-token.js';
import { isValidUsername, normalizeUsername } from './username.js';

function withoutPrivateFields(user: {
  id: string;
  username: string;
  displayName: string;
  role: PublicUser['role'];
  team: PublicUser['team'];
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    team: user.team,
  };
}

export function createAuthService(repository: AuthRepository): AuthService {
  return {
    async login(username, password) {
      const normalizedUsername = normalizeUsername(username);

      if (!isValidUsername(normalizedUsername)) {
        return null;
      }

      const user = await repository.findUserByUsername(normalizedUsername);

      const passwordMatches = await verifyPasswordWithFallback(
        password,
        user?.passwordHash,
      );

      if (!user || !passwordMatches || !user.isActive) {
        return null;
      }

      const { rawToken, tokenHash } = await createSessionToken();
      const expiresAt = new Date(
        Date.now() + AUTH_SESSION_DURATION_MILLISECONDS,
      );

      await repository.createSession({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      return {
        user: withoutPrivateFields(user),
        sessionToken: rawToken,
      };
    },

    async getSession(sessionToken) {
      if (!isValidSessionToken(sessionToken)) {
        return null;
      }

      const tokenHash = hashSessionToken(sessionToken);
      const user = await repository.findActiveUserBySessionTokenHash(
        tokenHash,
        new Date(),
      );

      if (!user) {
        await repository.deleteSessionByTokenHash(tokenHash);
      }

      return user;
    },

    async logout(sessionToken) {
      if (!sessionToken || !isValidSessionToken(sessionToken)) {
        return;
      }

      await repository.deleteSessionByTokenHash(
        hashSessionToken(sessionToken),
      );
    },
  };
}
