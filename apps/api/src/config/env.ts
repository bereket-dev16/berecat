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

export const env = Object.freeze({ databaseUrl });
