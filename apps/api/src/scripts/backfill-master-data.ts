import { closeDatabase, db } from '../db/client.js';
import { backfillMasterDataFromWorkItems } from '../features/master-data/master-data.backfill.js';

async function runBackfill(): Promise<void> {
  let succeeded = false;

  try {
    const result = await backfillMasterDataFromWorkItems(db);
    process.stdout.write(
      `Ana veri backfill tamamlandı: ${JSON.stringify(result)}\n`,
    );
    succeeded = true;
  } catch {
    process.stderr.write('Ana veri backfill işlemi tamamlanamadı.\n');
    process.exitCode = 1;
  } finally {
    try {
      await closeDatabase();
    } catch {
      succeeded = false;
      process.stderr.write('Veritabanı bağlantı havuzu kapatılamadı.\n');
      process.exitCode = 1;
    }
  }

  if (!succeeded) {
    process.exitCode = 1;
  }
}

await runBackfill();
