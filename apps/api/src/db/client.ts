import { drizzle } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'node:fs';
import { Pool, type PoolConfig } from 'pg';

import { env } from '../config/env.js';
import * as schema from './schema/index.js';

function readSupabaseRootCa(): string {
  try {
    return readFileSync(
      new URL('../../certs/supabase-root-ca.crt', import.meta.url),
      'utf8',
    );
  } catch {
    throw new Error('Supabase kök CA sertifikası okunamadı.');
  }
}

function createPoolConfig(databaseUrl: string): PoolConfig {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL geçerli bir PostgreSQL adresi olmalıdır.');
  }

  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL geçerli bir PostgreSQL adresi olmalıdır.');
  }

  const sslMode = parsedUrl.searchParams.get('sslmode')?.trim().toLowerCase();
  const sslValue = parsedUrl.searchParams.get('ssl')?.trim().toLowerCase();

  if (parsedUrl.searchParams.has('sslmode') && !sslMode) {
    throw new Error('DATABASE_URL geçerli bir TLS modu içermelidir.');
  }

  if (
    sslMode &&
    !['require', 'verify-ca', 'verify-full'].includes(sslMode)
  ) {
    throw new Error('DATABASE_URL geçerli bir TLS modu içermelidir.');
  }

  if (
    parsedUrl.searchParams.has('ssl') &&
    sslValue !== 'true' &&
    sslValue !== '1' &&
    sslValue !== 'false' &&
    sslValue !== '0'
  ) {
    throw new Error('DATABASE_URL geçerli bir TLS ayarı içermelidir.');
  }

  if (
    sslMode === 'disable' ||
    sslMode === 'allow' ||
    sslMode === 'prefer' ||
    sslMode === 'no-verify' ||
    sslValue === '0' ||
    sslValue === 'false'
  ) {
    throw new Error('DATABASE_URL TLS bağlantısı kullanmalıdır.');
  }

  const certificateParameters = ['sslcert', 'sslkey', 'sslrootcert'];

  if (
    certificateParameters.some((parameter) =>
      parsedUrl.searchParams.has(parameter),
    )
  ) {
    throw new Error(
      'DATABASE_URL üzerinden özel sertifika yapılandırması desteklenmiyor.',
    );
  }

  parsedUrl.searchParams.delete('sslmode');
  parsedUrl.searchParams.delete('ssl');
  parsedUrl.searchParams.delete('uselibpqcompat');

  return {
    connectionString: parsedUrl.toString(),
    ssl: {
      ca: readSupabaseRootCa(),
      rejectUnauthorized: true,
    },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  };
}

const pool = new Pool(createPoolConfig(env.databaseUrl));

pool.on('error', () => {
  process.stderr.write(
    'Boştaki veritabanı bağlantısında beklenmeyen bir hata oluştu.\n',
  );
});

export const db = drizzle({ client: pool, schema });

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
