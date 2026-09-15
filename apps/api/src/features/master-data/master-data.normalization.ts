import { MASTER_DATA_KIND_MAX_LENGTHS } from './master-data.constants.js';
import type { MasterDataKind } from './master-data.constants.js';
import type { NormalizedMasterDataValue } from './master-data.types.js';

const PLACEHOLDER_KEYS = new Set([
  'n a',
  'na',
  'null',
  'undefined',
  'not defined',
  'tanimsiz',
]);

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

export function normalizeMasterDataDisplayValue(value: string): string {
  return collapseWhitespace(value.normalize('NFKC'));
}

function foldTurkishCharacters(value: string): string {
  return normalizeMasterDataDisplayValue(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıi]/gu, 'i')
    .replace(/ğ/gu, 'g')
    .replace(/ü/gu, 'u')
    .replace(/ş/gu, 's')
    .replace(/ö/gu, 'o')
    .replace(/ç/gu, 'c')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '');
}

export function createMasterDataNormalizedKey(value: string): string {
  return collapseWhitespace(
    foldTurkishCharacters(value).replace(
      /\s*([\p{P}\p{S}])\s*/gu,
      '$1',
    ),
  );
}

export function createMasterDataSearchValue(value: string): string {
  return collapseWhitespace(
    foldTurkishCharacters(value).replace(/[\p{P}\p{S}]+/gu, ' '),
  );
}

export function normalizeMasterDataValue(
  value: string,
): NormalizedMasterDataValue {
  const displayValue = normalizeMasterDataDisplayValue(value);
  const searchValue = createMasterDataSearchValue(displayValue);

  return {
    displayValue,
    normalizedKey: createMasterDataNormalizedKey(displayValue),
    searchValue,
  };
}

export function isMasterDataPlaceholder(value: string): boolean {
  const displayValue = normalizeMasterDataDisplayValue(value);

  if (!displayValue || ['?', '-', '—', '–'].includes(displayValue)) {
    return true;
  }

  const searchValue = createMasterDataSearchValue(displayValue);
  return Boolean(searchValue) && PLACEHOLDER_KEYS.has(searchValue);
}

export function isMasterDataValueOverlength(
  kind: MasterDataKind,
  value: string,
): boolean {
  return (
    Array.from(normalizeMasterDataDisplayValue(value)).length >
    MASTER_DATA_KIND_MAX_LENGTHS[kind]
  );
}

export function isSuspiciousMasterDataValue(
  kind: MasterDataKind,
  value: string,
): boolean {
  const normalized = normalizeMasterDataValue(value);
  const containsControlCharacter = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

  if (!normalized.displayValue || containsControlCharacter) {
    return true;
  }

  if (!/[\p{L}\p{N}]/u.test(normalized.displayValue)) {
    return true;
  }

  if (
    (kind === 'company' || kind === 'supplier') &&
    /^\d+$/u.test(normalized.normalizedKey.replace(/ /gu, ''))
  ) {
    return true;
  }

  if (kind === 'order_type' && normalized.displayValue.length > 30) {
    return true;
  }

  return kind === 'packaging_type' && normalized.displayValue.length > 80;
}

export function areSameMasterDataValues(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    normalizeMasterDataValue(left).normalizedKey ===
    normalizeMasterDataValue(right).normalizedKey
  );
}
