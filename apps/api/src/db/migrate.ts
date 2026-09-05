import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';

import { closeDatabase, db } from './client.js';

const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

async function runMigrations(): Promise<void> {
  let migrationSucceeded = false;

  try {
    await migrate(db, { migrationsFolder });
    migrationSucceeded = true;
  } catch {
    process.stderr.write(
      'Migration uygulanamadı. Veritabanı bağlantısını ve migration dosyalarını kontrol edin.\n',
    );
    process.exitCode = 1;
  } finally {
    try {
      await closeDatabase();
    } catch {
      migrationSucceeded = false;
      process.stderr.write('Veritabanı bağlantı havuzu kapatılamadı.\n');
      process.exitCode = 1;
    }
  }

  if (migrationSucceeded) {
    process.stdout.write('Migration başarıyla uygulandı.\n');
  }
}

await runMigrations();
