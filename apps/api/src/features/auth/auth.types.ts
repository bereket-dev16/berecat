export type UserRole = 'admin' | 'member';
export type UserTeam = 'graphic' | 'digital';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  team: UserTeam;
}

export interface StoredUser extends PublicUser {
  passwordHash: string;
  isActive: boolean;
}

export interface NewUser {
  username: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  team: UserTeam;
}

export interface NewSession {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByUsername(username: string): Promise<StoredUser | null>;
  createSession(session: NewSession): Promise<void>;
  findActiveUserBySessionTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<PublicUser | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}

export interface UserCreationRepository {
  createUser(user: NewUser): Promise<boolean>;
}

export interface LoginResult {
  user: PublicUser;
  sessionToken: string;
}

export interface AuthService {
  login(username: string, password: string): Promise<LoginResult | null>;
  getSession(sessionToken: string): Promise<PublicUser | null>;
  logout(sessionToken: string | undefined): Promise<void>;
}
