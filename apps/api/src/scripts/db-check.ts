import { sql } from 'drizzle-orm';

import { closeDatabase, db } from '../db/client.js';

async function checkDatabase(): Promise<void> {
  let checkSucceeded = false;

  try {
    await db.execute(sql`select 1`);
    checkSucceeded = true;
  } catch {
    process.stderr.write('Veritabanı bağlantısı doğrulanamadı.\n');
    process.exitCode = 1;
  } finally {
    try {
      await closeDatabase();
    } catch {
      checkSucceeded = false;
      process.stderr.write('Veritabanı bağlantı havuzu kapatılamadı.\n');
      process.exitCode = 1;
    }
  }

  if (checkSucceeded) {
    process.stdout.write('Veritabanı bağlantısı başarılı.\n');
  }
}

await checkDatabase();
