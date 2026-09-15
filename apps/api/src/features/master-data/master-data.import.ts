import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { parse } from 'csv-parse';

import * as schema from '../../db/schema/index.js';
import {
  masterDataEntries,
  masterDataImportBatches,
  masterDataRelations,
} from '../../db/schema/index.js';
import {
  EXPECTED_MASTER_DATA_CSV_HEADERS,
  MASTER_DATA_CSV_COLUMNS,
  MASTER_DATA_KINDS,
  MASTER_DATA_RELATION_TYPES,
} from './master-data.constants.js';
import type {
  MasterDataKind,
  MasterDataRelationType,
} from './master-data.constants.js';
import {
  isMasterDataPlaceholder,
  isMasterDataValueOverlength,
  isSuspiciousMasterDataValue,
  normalizeMasterDataDisplayValue,
  normalizeMasterDataValue,
} from './master-data.normalization.js';
import type {
  MasterDataFuzzyCandidate,
  MasterDataImportAnalysis,
  MasterDataImportApplyResult,
  MasterDataImportIssue,
  MasterDataImportSummary,
  MasterDataKindCounts,
  MasterDataRelationCounts,
  NormalizedMasterDataValue,
  PreparedMasterDataEntry,
  PreparedMasterDataRelation,
} from './master-data.types.js';

type MasterDataDatabase = NodePgDatabase<typeof schema>;

interface DisplayVariant {
  count: number;
  firstSeen: number;
}

interface ValueGroup {
  normalizedKey: string;
  searchValue: string;
  usageCount: number;
  variants: Map<string, DisplayVariant>;
}

interface KindAccumulator {
  rawValueCount: number;
  rawUniqueValues: Set<string>;
  groups: Map<string, ValueGroup>;
}

interface RelationAccumulator {
  relationType: MasterDataRelationType;
  fromKind: MasterDataKind;
  fromNormalizedKey: string;
  toKind: MasterDataKind;
  toNormalizedKey: string;
  usageCount: number;
}

interface AcceptedCell {
  value: NormalizedMasterDataValue;
}

function createKindCounts(): MasterDataKindCounts {
  return {
    company: 0,
    product: 0,
    packaging_type: 0,
    supplier: 0,
    order_type: 0,
    process_stage: 0,
  };
}

function createRelationCounts(): MasterDataRelationCounts {
  return {
    company_product: 0,
    product_packaging_type: 0,
    packaging_type_supplier: 0,
    packaging_type_order_type: 0,
  };
}

function createKindAccumulators(): Record<MasterDataKind, KindAccumulator> {
  return Object.fromEntries(
    MASTER_DATA_KINDS.map((kind) => [
      kind,
      {
        rawValueCount: 0,
        rawUniqueValues: new Set<string>(),
        groups: new Map<string, ValueGroup>(),
      },
    ]),
  ) as Record<MasterDataKind, KindAccumulator>;
}

async function calculateFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');

  try {
    for await (const chunk of createReadStream(filePath)) {
      hash.update(chunk);
    }
  } catch {
    throw new Error('CSV dosyası okunamadı.');
  }

  return hash.digest('hex');
}

function relationKey(
  relationType: MasterDataRelationType,
  fromNormalizedKey: string,
  toNormalizedKey: string,
): string {
  return `${relationType}\u0000${fromNormalizedKey}\u0000${toNormalizedKey}`;
}

function storedRelationKey(
  relationType: string,
  fromEntryId: string,
  toEntryId: string,
): string {
  return `${relationType}\u0000${fromEntryId}\u0000${toEntryId}`;
}

function entryKey(kind: MasterDataKind, normalizedKey: string): string {
  return `${kind}\u0000${normalizedKey}`;
}

function chooseCanonicalDisplayValue(group: ValueGroup): string {
  const variants = [...group.variants.entries()];
  variants.sort(
    ([, left], [, right]) =>
      right.count - left.count || left.firstSeen - right.firstSeen,
  );
  const canonical = variants[0]?.[0];

  if (!canonical) {
    throw new Error('Ana veri canonical değeri belirlenemedi.');
  }

  return normalizeMasterDataDisplayValue(canonical);
}

function boundedLevenshteinDistance(
  left: string,
  right: string,
  maximumDistance: number,
): number {
  if (Math.abs(left.length - right.length) > maximumDistance) {
    return maximumDistance + 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > maximumDistance) {
      return maximumDistance + 1;
    }

    previous = current;
  }

  return previous[right.length] ?? maximumDistance + 1;
}

function findFuzzyCandidates(
  kind: MasterDataKind,
  entries: PreparedMasterDataEntry[],
): MasterDataFuzzyCandidate[] {
  const candidates: MasterDataFuzzyCandidate[] = [];
  const comparable = entries.filter((entry) => entry.kind === kind);

  for (let leftIndex = 0; leftIndex < comparable.length; leftIndex += 1) {
    const left = comparable[leftIndex];

    if (!left) {
      continue;
    }

    const leftKey = left.normalizedKey.replace(/ /gu, '');

    if (leftKey.length < 6) {
      continue;
    }

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < comparable.length;
      rightIndex += 1
    ) {
      const right = comparable[rightIndex];

      if (!right) {
        continue;
      }

      const rightKey = right.normalizedKey.replace(/ /gu, '');

      if (
        rightKey.length < 6 ||
        Math.abs(leftKey.length - rightKey.length) > 1
      ) {
        continue;
      }

      if (boundedLevenshteinDistance(leftKey, rightKey, 1) === 1) {
        candidates.push({
          kind,
          leftValue: left.displayValue,
          rightValue: right.displayValue,
        });
      }
    }
  }

  return candidates;
}

function chunksOf<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function safeStoredSummary(
  summary: MasterDataImportSummary,
): MasterDataImportSummary {
  return {
    totalRows: summary.totalRows,
    nonEmptyProductRows: summary.nonEmptyProductRows,
    acceptedValues: summary.acceptedValues,
    skippedValues: summary.skippedValues,
    placeholderValues: summary.placeholderValues,
    overlengthValues: summary.overlengthValues,
    suspiciousValues: summary.suspiciousValues,
    productsWithoutCompany: summary.productsWithoutCompany,
    rawValueCountByKind: { ...summary.rawValueCountByKind },
    rawUniqueCountByKind: { ...summary.rawUniqueCountByKind },
    normalizedUniqueCountByKind: { ...summary.normalizedUniqueCountByKind },
    safeDuplicateGroupCountByKind: {
      ...summary.safeDuplicateGroupCountByKind,
    },
    fuzzyCandidateCountByKind: { ...summary.fuzzyCandidateCountByKind },
    relationCountByType: { ...summary.relationCountByType },
    relationUsageCountByType: { ...summary.relationUsageCountByType },
    missingHeaderCount: summary.missingHeaderCount,
    extraHeaderCount: summary.extraHeaderCount,
    columnMismatchRowCount: summary.columnMismatchRowCount,
    blockingProblemCount: summary.blockingProblemCount,
  };
}

export async function analyzeMasterDataCsv(
  filePath: string,
): Promise<MasterDataImportAnalysis> {
  const fileSha256 = await calculateFileSha256(filePath);
  const kindAccumulators = createKindAccumulators();
  const issues: MasterDataImportIssue[] = [];
  const relations = new Map<string, RelationAccumulator>();
  const blockingProblems: string[] = [];
  let headers: string[] | null = null;
  let totalRows = 0;
  let nonEmptyProductRows = 0;
  let acceptedValues = 0;
  let skippedValues = 0;
  let placeholderValues = 0;
  let overlengthValues = 0;
  let suspiciousValues = 0;
  let productsWithoutCompany = 0;
  let columnMismatchRowCount = 0;
  let firstSeenSequence = 0;
  let currentCompany: NormalizedMasterDataValue | null = null;

  function acceptCell(
    kind: MasterDataKind,
    rawValue: string,
    rowNumber: number,
  ): AcceptedCell | null {
    const displayValue = normalizeMasterDataDisplayValue(rawValue);

    if (!displayValue) {
      return null;
    }

    const accumulator = kindAccumulators[kind];
    accumulator.rawValueCount += 1;
    accumulator.rawUniqueValues.add(rawValue);

    let issueReason: MasterDataImportIssue['reason'] | null = null;

    if (isMasterDataPlaceholder(displayValue)) {
      issueReason = 'placeholder';
      placeholderValues += 1;
    } else if (isMasterDataValueOverlength(kind, displayValue)) {
      issueReason = 'overlength';
      overlengthValues += 1;
    } else if (isSuspiciousMasterDataValue(kind, displayValue)) {
      issueReason = 'suspicious';
      suspiciousValues += 1;
    }

    if (issueReason) {
      skippedValues += 1;
      issues.push({ kind, rowNumber, value: displayValue, reason: issueReason });
      return null;
    }

    const value = normalizeMasterDataValue(displayValue);

    if (!value.normalizedKey) {
      skippedValues += 1;
      placeholderValues += 1;
      issues.push({
        kind,
        rowNumber,
        value: displayValue,
        reason: 'placeholder',
      });
      return null;
    }

    acceptedValues += 1;
    firstSeenSequence += 1;
    let group = accumulator.groups.get(value.normalizedKey);

    if (!group) {
      group = {
        normalizedKey: value.normalizedKey,
        searchValue: value.searchValue,
        usageCount: 0,
        variants: new Map<string, DisplayVariant>(),
      };
      accumulator.groups.set(value.normalizedKey, group);
    }

    group.usageCount += 1;
    const variant = group.variants.get(rawValue);

    if (variant) {
      variant.count += 1;
    } else {
      group.variants.set(rawValue, {
        count: 1,
        firstSeen: firstSeenSequence,
      });
    }

    return { value };
  }

  function addRelation(
    relationType: MasterDataRelationType,
    fromKind: MasterDataKind,
    fromValue: NormalizedMasterDataValue | null,
    toKind: MasterDataKind,
    toValue: NormalizedMasterDataValue | null,
  ): void {
    if (!fromValue || !toValue) {
      return;
    }

    const key = relationKey(
      relationType,
      fromValue.normalizedKey,
      toValue.normalizedKey,
    );
    const existing = relations.get(key);

    if (existing) {
      existing.usageCount += 1;
      return;
    }

    relations.set(key, {
      relationType,
      fromKind,
      fromNormalizedKey: fromValue.normalizedKey,
      toKind,
      toNormalizedKey: toValue.normalizedKey,
      usageCount: 1,
    });
  }

  try {
    const parser = createReadStream(filePath).pipe(
      parse({
        bom: true,
        delimiter: ',',
        relax_column_count: true,
        skip_empty_lines: true,
      }),
    );

    for await (const parsedRecord of parser) {
      if (!Array.isArray(parsedRecord)) {
        throw new Error('CSV satırı geçersiz.');
      }

      const record = parsedRecord.map((cell) => String(cell));

      if (!headers) {
        headers = record.map((header) => header.trim());

        if (new Set(headers).size !== headers.length) {
          blockingProblems.push('CSV başlıkları tekrar içeriyor.');
        }

        continue;
      }

      totalRows += 1;
      const rowNumber = totalRows + 1;

      if (record.length !== headers.length) {
        columnMismatchRowCount += 1;
      }

      const row = new Map<string, string>();

      headers.forEach((header, index) => {
        row.set(header, record[index] ?? '');
      });

      const rawCompany = row.get(MASTER_DATA_CSV_COLUMNS.company) ?? '';
      let rowCompany: AcceptedCell | null = null;

      if (normalizeMasterDataDisplayValue(rawCompany)) {
        rowCompany = acceptCell('company', rawCompany, rowNumber);
        currentCompany = rowCompany?.value ?? null;
      }

      const rawProduct = row.get(MASTER_DATA_CSV_COLUMNS.product) ?? '';

      if (normalizeMasterDataDisplayValue(rawProduct)) {
        nonEmptyProductRows += 1;
      }

      const product = acceptCell('product', rawProduct, rowNumber);
      const packagingType = acceptCell(
        'packaging_type',
        row.get(MASTER_DATA_CSV_COLUMNS.packaging_type) ?? '',
        rowNumber,
      );
      const supplier = acceptCell(
        'supplier',
        row.get(MASTER_DATA_CSV_COLUMNS.supplier) ?? '',
        rowNumber,
      );
      const orderType = acceptCell(
        'order_type',
        row.get(MASTER_DATA_CSV_COLUMNS.order_type) ?? '',
        rowNumber,
      );
      acceptCell(
        'process_stage',
        row.get(MASTER_DATA_CSV_COLUMNS.process_stage) ?? '',
        rowNumber,
      );

      if (product && !currentCompany) {
        productsWithoutCompany += 1;
      }

      addRelation(
        'company_product',
        'company',
        currentCompany,
        'product',
        product?.value ?? null,
      );
      addRelation(
        'product_packaging_type',
        'product',
        product?.value ?? null,
        'packaging_type',
        packagingType?.value ?? null,
      );
      addRelation(
        'packaging_type_supplier',
        'packaging_type',
        packagingType?.value ?? null,
        'supplier',
        supplier?.value ?? null,
      );
      addRelation(
        'packaging_type_order_type',
        'packaging_type',
        packagingType?.value ?? null,
        'order_type',
        orderType?.value ?? null,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'CSV dosyası okunamadı.') {
      throw error;
    }

    throw new Error('CSV dosyası güvenli biçimde ayrıştırılamadı.', {
      cause: error,
    });
  }

  if (!headers) {
    blockingProblems.push('CSV başlık satırı bulunamadı.');
    headers = [];
  }

  const expectedHeaderSet = new Set<string>(EXPECTED_MASTER_DATA_CSV_HEADERS);
  const missingHeaders = EXPECTED_MASTER_DATA_CSV_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  const extraHeaders = headers.filter((header) => !expectedHeaderSet.has(header));

  if (missingHeaders.length > 0) {
    blockingProblems.push(
      `CSV ${missingHeaders.length} zorunlu başlığı içermiyor.`,
    );
  }

  if (columnMismatchRowCount > 0) {
    blockingProblems.push(
      `CSV ${columnMismatchRowCount} satırda başlıklarla uyumsuz kolon sayısı içeriyor.`,
    );
  }

  const entries: PreparedMasterDataEntry[] = [];
  const rawValueCountByKind = createKindCounts();
  const rawUniqueCountByKind = createKindCounts();
  const normalizedUniqueCountByKind = createKindCounts();
  const safeDuplicateGroupCountByKind = createKindCounts();

  for (const kind of MASTER_DATA_KINDS) {
    const accumulator = kindAccumulators[kind];
    rawValueCountByKind[kind] = accumulator.rawValueCount;
    rawUniqueCountByKind[kind] = accumulator.rawUniqueValues.size;
    normalizedUniqueCountByKind[kind] = accumulator.groups.size;

    for (const group of accumulator.groups.values()) {
      if (group.variants.size > 1) {
        safeDuplicateGroupCountByKind[kind] += 1;
      }

      entries.push({
        kind,
        displayValue: chooseCanonicalDisplayValue(group),
        normalizedKey: group.normalizedKey,
        searchValue: group.searchValue,
        usageCount: group.usageCount,
      });
    }
  }

  const fuzzyCandidates = MASTER_DATA_KINDS.flatMap((kind) =>
    findFuzzyCandidates(kind, entries),
  );
  const fuzzyCandidateCountByKind = createKindCounts();

  for (const candidate of fuzzyCandidates) {
    fuzzyCandidateCountByKind[candidate.kind] += 1;
  }

  const preparedRelations: PreparedMasterDataRelation[] = [
    ...relations.values(),
  ];
  const relationCountByType = createRelationCounts();
  const relationUsageCountByType = createRelationCounts();

  for (const relation of preparedRelations) {
    relationCountByType[relation.relationType] += 1;
    relationUsageCountByType[relation.relationType] += relation.usageCount;
  }

  const summary: MasterDataImportSummary = {
    totalRows,
    nonEmptyProductRows,
    acceptedValues,
    skippedValues,
    placeholderValues,
    overlengthValues,
    suspiciousValues,
    productsWithoutCompany,
    rawValueCountByKind,
    rawUniqueCountByKind,
    normalizedUniqueCountByKind,
    safeDuplicateGroupCountByKind,
    fuzzyCandidateCountByKind,
    relationCountByType,
    relationUsageCountByType,
    missingHeaderCount: missingHeaders.length,
    extraHeaderCount: extraHeaders.length,
    columnMismatchRowCount,
    blockingProblemCount: blockingProblems.length,
  };

  return {
    fileSha256,
    sourceFilename: basename(filePath),
    summary,
    entries,
    relations: preparedRelations,
    issues,
    fuzzyCandidates,
    blockingProblems,
  };
}

export async function applyMasterDataImport(
  database: MasterDataDatabase,
  analysis: MasterDataImportAnalysis,
): Promise<MasterDataImportApplyResult> {
  if (analysis.blockingProblems.length > 0) {
    throw new Error('CSV importunu engelleyen parser sorunları var.');
  }

  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(20260915, 30301)`,
    );
    const [existingBatch] = await tx
      .select({
        id: masterDataImportBatches.id,
        fileSha256: masterDataImportBatches.fileSha256,
      })
      .from(masterDataImportBatches)
      .limit(1);

    if (existingBatch?.fileSha256 === analysis.fileSha256) {
      return { status: 'already-applied' as const };
    }

    if (existingBatch) {
      throw new Error(
        'Başlangıç ana verisi daha önce farklı bir dosyadan içeri aktarıldı.',
      );
    }

    const existingEntryKeys = new Set<string>();

    for (const kind of MASTER_DATA_KINDS) {
      const normalizedKeys = analysis.entries
        .filter((entry) => entry.kind === kind)
        .map((entry) => entry.normalizedKey);

      for (const keyChunk of chunksOf(normalizedKeys, 250)) {
        if (keyChunk.length === 0) {
          continue;
        }

        const existingRows = await tx
          .select({
            kind: masterDataEntries.kind,
            normalizedKey: masterDataEntries.normalizedKey,
          })
          .from(masterDataEntries)
          .where(
            and(
              eq(masterDataEntries.kind, kind),
              inArray(masterDataEntries.normalizedKey, keyChunk),
            ),
          );

        for (const row of existingRows) {
          existingEntryKeys.add(entryKey(kind, row.normalizedKey));
        }
      }
    }

    const now = new Date();
    const entryIds = new Map<string, string>();

    for (const entryChunk of chunksOf(analysis.entries, 250)) {
      if (entryChunk.length === 0) {
        continue;
      }

      const rows = await tx
        .insert(masterDataEntries)
        .values(
          entryChunk.map((entry) => ({
            kind: entry.kind,
            displayValue: entry.displayValue,
            normalizedKey: entry.normalizedKey,
            searchValue: entry.searchValue,
            source: 'csv' as const,
            usageCount: entry.usageCount,
            lastUsedAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [masterDataEntries.kind, masterDataEntries.normalizedKey],
          set: {
            usageCount: sql`${masterDataEntries.usageCount} + excluded.usage_count`,
            lastUsedAt: now,
            updatedAt: now,
          },
        })
        .returning({
          id: masterDataEntries.id,
          kind: masterDataEntries.kind,
          normalizedKey: masterDataEntries.normalizedKey,
        });

      for (const row of rows) {
        entryIds.set(
          entryKey(row.kind as MasterDataKind, row.normalizedKey),
          row.id,
        );
      }
    }

    const preparedRelationRows = analysis.relations.map((relation) => {
      const fromEntryId = entryIds.get(
        entryKey(relation.fromKind, relation.fromNormalizedKey),
      );
      const toEntryId = entryIds.get(
        entryKey(relation.toKind, relation.toNormalizedKey),
      );

      if (!fromEntryId || !toEntryId) {
        throw new Error('Ana veri ilişkisi için entry bulunamadı.');
      }

      return {
        relationType: relation.relationType,
        fromEntryId,
        toEntryId,
        usageCount: relation.usageCount,
      };
    });
    const relevantEntryIds = [...new Set(
      preparedRelationRows.flatMap((relation) => [
        relation.fromEntryId,
        relation.toEntryId,
      ]),
    )];
    const existingRelationKeys = new Set<string>();

    for (const idChunk of chunksOf(relevantEntryIds, 250)) {
      if (idChunk.length === 0) {
        continue;
      }

      const existingRows = await tx
        .select({
          relationType: masterDataRelations.relationType,
          fromEntryId: masterDataRelations.fromEntryId,
          toEntryId: masterDataRelations.toEntryId,
        })
        .from(masterDataRelations)
        .where(
          and(
            inArray(
              masterDataRelations.relationType,
              MASTER_DATA_RELATION_TYPES,
            ),
            inArray(masterDataRelations.fromEntryId, idChunk),
          ),
        );

      for (const row of existingRows) {
        existingRelationKeys.add(
          storedRelationKey(
            row.relationType,
            row.fromEntryId,
            row.toEntryId,
          ),
        );
      }
    }

    for (const relationChunk of chunksOf(preparedRelationRows, 250)) {
      if (relationChunk.length === 0) {
        continue;
      }

      await tx
        .insert(masterDataRelations)
        .values(
          relationChunk.map((relation) => ({
            ...relation,
            lastUsedAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [
            masterDataRelations.relationType,
            masterDataRelations.fromEntryId,
            masterDataRelations.toEntryId,
          ],
          set: {
            usageCount: sql`${masterDataRelations.usageCount} + excluded.usage_count`,
            lastUsedAt: now,
            updatedAt: now,
          },
        });
    }

    const insertedEntries = analysis.entries.filter(
      (entry) =>
        !existingEntryKeys.has(entryKey(entry.kind, entry.normalizedKey)),
    ).length;
    const insertedRelations = preparedRelationRows.filter(
      (relation) =>
        !existingRelationKeys.has(
          storedRelationKey(
            relation.relationType,
            relation.fromEntryId,
            relation.toEntryId,
          ),
        ),
    ).length;
    const updatedEntries = analysis.entries.length - insertedEntries;

    await tx.insert(masterDataImportBatches).values({
      fileSha256: analysis.fileSha256,
      sourceFilename: analysis.sourceFilename,
      totalRows: analysis.summary.totalRows,
      acceptedValues: analysis.summary.acceptedValues,
      skippedValues: analysis.summary.skippedValues,
      suspiciousValues: analysis.summary.suspiciousValues,
      insertedEntries,
      updatedEntries,
      insertedRelations,
      status: 'applied',
      summary: safeStoredSummary(analysis.summary),
    });

    return {
      status: 'applied' as const,
      insertedEntries,
      updatedEntries,
      insertedRelations,
    };
  });
}
