import {
  MASTER_DATA_KIND_MAX_LENGTHS,
  MASTER_DATA_QUERY_MAX_LENGTH,
  MASTER_DATA_SUGGESTION_LIMIT_DEFAULT,
  MASTER_DATA_SUGGESTION_LIMIT_MAX,
  isMasterDataKind,
} from './master-data.constants.js';
import type {
  MasterDataKind,
  MasterDataRelationType,
} from './master-data.constants.js';
import {
  isMasterDataPlaceholder,
  normalizeMasterDataValue,
} from './master-data.normalization.js';
import type {
  MasterDataRepository,
  MasterDataService,
  MasterDataSuggestionQueryInput,
  NormalizedMasterDataSuggestionQuery,
} from './master-data.types.js';

interface ContextDefinition {
  parameter: keyof Pick<
    MasterDataSuggestionQueryInput,
    'company' | 'product' | 'packagingType'
  >;
  contextKind: MasterDataKind;
  relationType: MasterDataRelationType;
  candidateDirection: 'from' | 'to';
}

const CONTEXT_BY_KIND: Partial<Record<MasterDataKind, ContextDefinition>> = {
  product: {
    parameter: 'company',
    contextKind: 'company',
    relationType: 'company_product',
    candidateDirection: 'to',
  },
  packaging_type: {
    parameter: 'product',
    contextKind: 'product',
    relationType: 'product_packaging_type',
    candidateDirection: 'to',
  },
  supplier: {
    parameter: 'packagingType',
    contextKind: 'packaging_type',
    relationType: 'packaging_type_supplier',
    candidateDirection: 'to',
  },
  order_type: {
    parameter: 'packagingType',
    contextKind: 'packaging_type',
    relationType: 'packaging_type_order_type',
    candidateDirection: 'to',
  },
};

function normalizeSuggestionQuery(
  input: MasterDataSuggestionQueryInput,
):
  | { status: 'success'; value: NormalizedMasterDataSuggestionQuery }
  | { status: 'invalid'; message: string } {
  if (!isMasterDataKind(input.kind)) {
    return { status: 'invalid', message: 'Ana veri türü geçersiz.' };
  }

  const limit = input.limit ?? MASTER_DATA_SUGGESTION_LIMIT_DEFAULT;

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MASTER_DATA_SUGGESTION_LIMIT_MAX
  ) {
    return { status: 'invalid', message: 'Öneri limiti geçersiz.' };
  }

  const queryText = input.q?.trim() ?? '';

  if (Array.from(queryText).length > MASTER_DATA_QUERY_MAX_LENGTH) {
    return {
      status: 'invalid',
      message: 'Arama metni en fazla 100 karakter olabilir.',
    };
  }

  const normalizedQuery = queryText
    ? normalizeMasterDataValue(queryText)
    : null;
  const q = normalizedQuery?.searchValue ? normalizedQuery : null;
  const contextDefinition = CONTEXT_BY_KIND[input.kind];
  let context: NormalizedMasterDataSuggestionQuery['context'] = null;

  if (contextDefinition) {
    const rawContext = input[contextDefinition.parameter]?.trim() ?? '';

    if (
      Array.from(rawContext).length >
      MASTER_DATA_KIND_MAX_LENGTHS[contextDefinition.contextKind]
    ) {
      return { status: 'invalid', message: 'Bağlam değeri geçersiz.' };
    }

    if (rawContext && !isMasterDataPlaceholder(rawContext)) {
      const normalizedContext = normalizeMasterDataValue(rawContext);

      if (normalizedContext.normalizedKey) {
        context = {
          relationType: contextDefinition.relationType,
          contextKind: contextDefinition.contextKind,
          contextNormalizedKey: normalizedContext.normalizedKey,
          candidateDirection: contextDefinition.candidateDirection,
        };
      }
    }
  }

  return {
    status: 'success',
    value: { kind: input.kind, q, limit, context },
  };
}

export function createMasterDataService(
  repository: MasterDataRepository,
): MasterDataService {
  return {
    async getSuggestions(input) {
      const normalized = normalizeSuggestionQuery(input);

      if (normalized.status === 'invalid') {
        return normalized;
      }

      return {
        status: 'success',
        value: await repository.listSuggestions(normalized.value),
      };
    },
  };
}
