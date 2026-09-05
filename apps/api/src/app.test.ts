import type { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { INVALID_CREDENTIALS_MESSAGE } from './features/auth/auth.constants.js';
import { createAuthService } from './features/auth/auth.service.js';
import type {
  AuthRepository,
  NewSession,
  PublicUser,
  StoredUser,
} from './features/auth/auth.types.js';
import { hashPassword } from './features/auth/password.js';
import { hashSessionToken } from './features/auth/session-token.js';

const TEST_PASSWORD = 'Test-Parolasi!42';
const TEST_USER: Omit<StoredUser, 'passwordHash'> = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'test-kullanicisi',
  displayName: 'Test Kullanıcısı',
  role: 'member',
  team: 'graphic',
  isActive: true,
};

class FakeAuthRepository implements AuthRepository {
  private readonly users = new Map<string, StoredUser>();
  private readonly sessions = new Map<string, NewSession>();
  lastCreatedSession: NewSession | undefined;

  constructor(user?: StoredUser) {
    if (user) {
      this.users.set(user.username, user);
    }
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    return this.users.get(username) ?? null;
  }

  async createSession(session: NewSession): Promise<void> {
    this.lastCreatedSession = session;
    this.sessions.set(session.tokenHash, session);
  }

  async findActiveUserBySessionTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PublicUser | null> {
    const session = this.sessions.get(tokenHash);

    if (!session || session.expiresAt <= now) {
      return null;
    }

    const user = [...this.users.values()].find(
      (candidate) => candidate.id === session.userId,
    );

    if (!user?.isActive) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      team: user.team,
    };
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
}

function createTestApp(repository: AuthRepository): FastifyInstance {
  return buildApp({
    authService: createAuthService(repository),
    cookieSecure: false,
    logger: false,
  });
}

function readSetCookieHeader(header: string | string[] | undefined): string {
  if (!header) {
    throw new Error('Test yanıtında Set-Cookie başlığı bulunamadı.');
  }

  return Array.isArray(header) ? header[0] : header;
}

function readCookiePair(setCookieHeader: string): string {
  return setCookieHeader.split(';', 1)[0];
}

async function login(app: FastifyInstance, password = TEST_PASSWORD) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: `  ${TEST_USER.username.toUpperCase()}  `,
      password,
    },
  });
}

describe('BereCat API', () => {
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(TEST_PASSWORD);
  });

  function repositoryWithActiveUser(): FakeAuthRepository {
    return new FakeAuthRepository({ ...TEST_USER, passwordHash });
  }

  it('GET /api/health teknik sağlık durumunu döndürür', async () => {
    const app = createTestApp(new FakeAuthRepository());

    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        service: 'berecat-api',
      });
    } finally {
      await app.close();
    }
  });

  it('başarılı login HTTP 200 ve güvenli kullanıcı döndürür', async () => {
    const app = createTestApp(repositoryWithActiveUser());

    try {
      const response = await login(app);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        user: {
          id: TEST_USER.id,
          username: TEST_USER.username,
          displayName: TEST_USER.displayName,
          role: TEST_USER.role,
          team: TEST_USER.team,
        },
      });
    } finally {
      await app.close();
    }
  });

  it('başarılı login HttpOnly session cookie oluşturur', async () => {
    const repository = repositoryWithActiveUser();
    const app = createTestApp(repository);

    try {
      const response = await login(app);
      const setCookie = readSetCookieHeader(response.headers['set-cookie']);
      const rawCookieToken = readCookiePair(setCookie).split('=', 2)[1];

      expect(setCookie).toContain('berecat_session=');
      expect(setCookie).toContain('Max-Age=2592000');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(rawCookieToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(repository.lastCreatedSession?.tokenHash).toMatch(
        /^[0-9a-f]{64}$/,
      );
      expect(repository.lastCreatedSession?.tokenHash).not.toBe(rawCookieToken);
      expect(repository.lastCreatedSession?.tokenHash).toBe(
        hashSessionToken(rawCookieToken),
      );
    } finally {
      await app.close();
    }
  });

  it('login cevabında parola, hash veya token alanı döndürmez', async () => {
    const app = createTestApp(repositoryWithActiveUser());

    try {
      const response = await login(app);
      const responseBody = response.body.toLowerCase();

      expect(responseBody).not.toContain(TEST_PASSWORD.toLowerCase());
      expect(responseBody).not.toContain('password');
      expect(responseBody).not.toContain('passwordhash');
      expect(responseBody).not.toContain('token');
    } finally {
      await app.close();
    }
  });

  it('hatalı login yalnızca genel HTTP 401 mesajı döndürür', async () => {
    const app = createTestApp(repositoryWithActiveUser());

    try {
      const response = await login(app, 'Yanlis-Test-Parolasi!');

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: INVALID_CREDENTIALS_MESSAGE });
      expect(response.headers['set-cookie']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('bilinmeyen kullanıcı için aynı genel HTTP 401 mesajını döndürür', async () => {
    const app = createTestApp(new FakeAuthRepository());

    try {
      const response = await login(app);

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: INVALID_CREDENTIALS_MESSAGE });
      expect(response.headers['set-cookie']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('pasif kullanıcı için aynı genel HTTP 401 mesajını döndürür', async () => {
    const app = createTestApp(
      new FakeAuthRepository({
        ...TEST_USER,
        passwordHash,
        isActive: false,
      }),
    );

    try {
      const response = await login(app);

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: INVALID_CREDENTIALS_MESSAGE });
    } finally {
      await app.close();
    }
  });

  it('geçerli session güvenli kullanıcı bilgisini döndürür', async () => {
    const app = createTestApp(repositoryWithActiveUser());

    try {
      const loginResponse = await login(app);
      const setCookie = readSetCookieHeader(loginResponse.headers['set-cookie']);
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: { cookie: readCookiePair(setCookie) },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        user: {
          id: TEST_USER.id,
          username: TEST_USER.username,
          displayName: TEST_USER.displayName,
          role: TEST_USER.role,
          team: TEST_USER.team,
        },
      });
    } finally {
      await app.close();
    }
  });

  it('session cookie bulunmadığında user null döndürür', async () => {
    const app = createTestApp(repositoryWithActiveUser());

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ user: null });
    } finally {
      await app.close();
    }
  });

  it('logout session kaydını ve cookie’yi temizler', async () => {
    const app = createTestApp(repositoryWithActiveUser());

    try {
      const loginResponse = await login(app);
      const loginCookie = readCookiePair(
        readSetCookieHeader(loginResponse.headers['set-cookie']),
      );
      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: loginCookie },
      });
      const clearedCookie = readSetCookieHeader(
        logoutResponse.headers['set-cookie'],
      );

      expect(logoutResponse.statusCode).toBe(204);
      expect(logoutResponse.body).toBe('');
      expect(clearedCookie).toContain('berecat_session=');
      expect(clearedCookie).toContain('Max-Age=0');
      expect(clearedCookie).toContain('Path=/');
      expect(clearedCookie).toContain('HttpOnly');
      expect(clearedCookie).toContain('SameSite=Lax');

      const sessionResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: { cookie: loginCookie },
      });
      expect(sessionResponse.json()).toEqual({ user: null });
    } finally {
      await app.close();
    }
  });

  it('cookie olmadan logout isteğini hatasız tamamlar', async () => {
    const app = createTestApp(repositoryWithActiveUser());

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    } finally {
      await app.close();
    }
  });
});
