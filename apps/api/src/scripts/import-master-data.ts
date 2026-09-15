import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeMasterDataCsv,
  applyMasterDataImport,
} from '../features/master-data/master-data.import.js';
import type { MasterDataImportSummary } from '../features/master-data/master-data.types.js';

class ImportArgumentError extends Error {}

interface ImportArguments {
  filePath: string;
  apply: boolean;
}

function parseArguments(args: string[]): ImportArguments {
  let filePath: string | undefined;
  let apply = false;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--file') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        throw new ImportArgumentError('--file için bir dosya yolu gereklidir.');
      }

      filePath = value;
      index += 1;
      continue;
    }

    if (argument === '--apply') {
      apply = true;
      continue;
    }

    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }

    throw new ImportArgumentError('Desteklenmeyen import argümanı verildi.');
  }

  if (!filePath) {
    throw new ImportArgumentError('--file argümanı zorunludur.');
  }

  if (apply && dryRun) {
    throw new ImportArgumentError(
      '--apply ve --dry-run aynı anda kullanılamaz.',
    );
  }

  return { filePath, apply };
}

function writeNumericSummary(summary: MasterDataImportSummary): void {
  process.stdout.write(`Toplam satır: ${summary.totalRows}\n`);
  process.stdout.write(`Dolu ürün satırı: ${summary.nonEmptyProductRows}\n`);
  process.stdout.write(
    `Ham değer sayıları: ${JSON.stringify(summary.rawValueCountByKind)}\n`,
  );
  process.stdout.write(
    `Ham unique sayıları: ${JSON.stringify(summary.rawUniqueCountByKind)}\n`,
  );
  process.stdout.write(
    `Normalize unique sayıları: ${JSON.stringify(
      summary.normalizedUniqueCountByKind,
    )}\n`,
  );
  process.stdout.write(
    `Safe duplicate grup sayıları: ${JSON.stringify(
      summary.safeDuplicateGroupCountByKind,
    )}\n`,
  );
  process.stdout.write(
    `Olası fuzzy duplicate sayıları: ${JSON.stringify(
      summary.fuzzyCandidateCountByKind,
    )}\n`,
  );
  process.stdout.write(`Placeholder sayısı: ${summary.placeholderValues}\n`);
  process.stdout.write(`Uzunluk aşımı sayısı: ${summary.overlengthValues}\n`);
  process.stdout.write(`Şüpheli değer sayısı: ${summary.suspiciousValues}\n`);
  process.stdout.write(
    `Firmasız ürün sayısı: ${summary.productsWithoutCompany}\n`,
  );
  process.stdout.write(
    `Relation sayıları: ${JSON.stringify(summary.relationCountByType)}\n`,
  );
  process.stdout.write(
    `Blocking parser sorunu: ${summary.blockingProblemCount}\n`,
  );
}

async function writeLocalReviewReport(
  analysis: Awaited<ReturnType<typeof analyzeMasterDataCsv>>,
): Promise<void> {
  const reportUrl = new URL(
    '../../../../.local/reports/master-data-import-report.json',
    import.meta.url,
  );
  await mkdir(dirname(fileURLToPath(reportUrl)), { recursive: true });
  await writeFile(
    reportUrl,
    `${JSON.stringify(
      {
        summary: analysis.summary,
        issues: analysis.issues,
        fuzzyCandidates: analysis.fuzzyCandidates,
        blockingProblems: analysis.blockingProblems,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function runImport(): Promise<void> {
  let closeDatabase: (() => Promise<void>) | undefined;
  let succeeded = false;

  try {
    const options = parseArguments(process.argv.slice(2));
    const analysis = await analyzeMasterDataCsv(options.filePath);
    await writeLocalReviewReport(analysis);
    writeNumericSummary(analysis.summary);

    if (analysis.blockingProblems.length > 0) {
      throw new ImportArgumentError(
        'CSV importunu engelleyen parser sorunları bulundu.',
      );
    }

    if (!options.apply) {
      process.stdout.write('Dry-run tamamlandı; veritabanı değiştirilmedi.\n');
      succeeded = true;
      return;
    }

    const databaseModule = await import('../db/client.js');
    closeDatabase = databaseModule.closeDatabase;
    const result = await applyMasterDataImport(databaseModule.db, analysis);

    if (result.status === 'already-applied') {
      process.stdout.write('Bu dosya daha önce içeri aktarıldı.\n');
    } else {
      process.stdout.write(
        `Import uygulandı: ${JSON.stringify({
          insertedEntries: result.insertedEntries,
          updatedEntries: result.updatedEntries,
          insertedRelations: result.insertedRelations,
        })}\n`,
      );
    }

    succeeded = true;
  } catch (error) {
    const message =
      error instanceof ImportArgumentError
        ? error.message
        : 'Ana veri içe aktarma işlemi tamamlanamadı.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  } finally {
    if (closeDatabase) {
      try {
        await closeDatabase();
      } catch {
        succeeded = false;
        process.stderr.write('Veritabanı bağlantı havuzu kapatılamadı.\n');
        process.exitCode = 1;
      }
    }
  }

  if (!succeeded) {
    process.exitCode = 1;
  }
}

await runImport();
