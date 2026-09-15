export const MASTER_DATA_KINDS = [
  'company',
  'product',
  'packaging_type',
  'supplier',
  'order_type',
  'process_stage',
] as const

export type MasterDataKind = (typeof MASTER_DATA_KINDS)[number]

export interface MasterDataSuggestion {
  id: string
  kind: MasterDataKind
  value: string
}

export interface MasterDataSuggestionContext {
  company?: string
  product?: string
  packagingType?: string
}

export type MasterDataRequestErrorKind =
  | 'unauthorized'
  | 'validation'
  | 'error'

export function isMasterDataKind(value: unknown): value is MasterDataKind {
  return (
    typeof value === 'string' &&
    MASTER_DATA_KINDS.some((kind) => kind === value)
  )
}
