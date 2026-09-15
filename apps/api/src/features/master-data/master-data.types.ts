import type {
  MasterDataKind,
  MasterDataRelationType,
  MasterDataSource,
} from './master-data.constants.js';

export interface NormalizedMasterDataValue {
  displayValue: string;
  normalizedKey: string;
  searchValue: string;
}

export interface MasterDataWorkItemValues {
  companyName: string | null;
  productName: string | null;
  packagingType: string | null;
  supplierCompany: string | null;
  orderType: string | null;
  processStage: string | null;
}

export interface MasterDataSuggestion {
  id: string;
  kind: MasterDataKind;
  value: string;
}

export interface MasterDataSuggestionQueryInput {
  kind: string;
  q?: string;
  limit?: number;
  company?: string;
  product?: string;
  packagingType?: string;
}

export interface NormalizedMasterDataSuggestionQuery {
  kind: MasterDataKind;
  q: NormalizedMasterDataValue | null;
  limit: number;
  context:
    | {
        relationType: MasterDataRelationType;
        contextKind: MasterDataKind;
        contextNormalizedKey: string;
        candidateDirection: 'from' | 'to';
      }
    | null;
}

export interface MasterDataRepository {
  listSuggestions(
    query: NormalizedMasterDataSuggestionQuery,
  ): Promise<MasterDataSuggestion[]>;
}

export type MasterDataServiceResult<T> =
  | { status: 'success'; value: T }
  | { status: 'invalid'; message: string };

export interface MasterDataService {
  getSuggestions(
    input: MasterDataSuggestionQueryInput,
  ): Promise<MasterDataServiceResult<MasterDataSuggestion[]>>;
}

export interface PreparedMasterDataEntry extends NormalizedMasterDataValue {
  kind: MasterDataKind;
  usageCount: number;
}

export interface PreparedMasterDataRelation {
  relationType: MasterDataRelationType;
  fromKind: MasterDataKind;
  fromNormalizedKey: string;
  toKind: MasterDataKind;
  toNormalizedKey: string;
  usageCount: number;
}

export interface MasterDataImportIssue {
  kind: MasterDataKind;
  rowNumber: number;
  value: string;
  reason: 'placeholder' | 'overlength' | 'suspicious';
}

export interface MasterDataFuzzyCandidate {
  kind: MasterDataKind;
  leftValue: string;
  rightValue: string;
}

export type MasterDataKindCounts = Record<MasterDataKind, number>;
export type MasterDataRelationCounts = Record<MasterDataRelationType, number>;

export interface MasterDataImportSummary {
  totalRows: number;
  nonEmptyProductRows: number;
  acceptedValues: number;
  skippedValues: number;
  placeholderValues: number;
  overlengthValues: number;
  suspiciousValues: number;
  productsWithoutCompany: number;
  rawValueCountByKind: MasterDataKindCounts;
  rawUniqueCountByKind: MasterDataKindCounts;
  normalizedUniqueCountByKind: MasterDataKindCounts;
  safeDuplicateGroupCountByKind: MasterDataKindCounts;
  fuzzyCandidateCountByKind: MasterDataKindCounts;
  relationCountByType: MasterDataRelationCounts;
  relationUsageCountByType: MasterDataRelationCounts;
  missingHeaderCount: number;
  extraHeaderCount: number;
  columnMismatchRowCount: number;
  blockingProblemCount: number;
}

export interface MasterDataImportAnalysis {
  fileSha256: string;
  sourceFilename: string;
  summary: MasterDataImportSummary;
  entries: PreparedMasterDataEntry[];
  relations: PreparedMasterDataRelation[];
  issues: MasterDataImportIssue[];
  fuzzyCandidates: MasterDataFuzzyCandidate[];
  blockingProblems: string[];
}

export type MasterDataImportApplyResult =
  | { status: 'already-applied' }
  | {
      status: 'applied';
      insertedEntries: number;
      updatedEntries: number;
      insertedRelations: number;
    };

export interface MasterDataBackfillResult {
  processedWorkItems: number;
  entriesSeen: number;
  relationsSeen: number;
}

export interface MasterDataEntryWrite {
  kind: MasterDataKind;
  source: MasterDataSource;
  value: NormalizedMasterDataValue;
  usageCount: number;
}
