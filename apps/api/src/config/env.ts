import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV !== 'production') {
  const envFilePath = fileURLToPath(new URL('../../.env', import.meta.url));
  config({ path: envFilePath, quiet: true });
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL tanımlı değil. apps/api/.env dosyasını kontrol edin.',
  );
}

function readCookieSecure(): boolean {
  const value = process.env.COOKIE_SECURE?.trim().toLowerCase();

  if (value === undefined) {
    return process.env.NODE_ENV === 'production';
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  throw new Error('COOKIE_SECURE true veya false olmalıdır.');
}

export const env = Object.freeze({
  databaseUrl,
  cookieSecure: readCookieSecure(),
});
