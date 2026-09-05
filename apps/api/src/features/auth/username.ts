export const USERNAME_MAX_LENGTH = 50;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return username.length >= 1 && username.length <= USERNAME_MAX_LENGTH;
}
