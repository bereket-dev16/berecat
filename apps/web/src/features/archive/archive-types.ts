import type { WorkItemModuleKey } from '../work-items/work-item-constants'

export interface ArchiveCompletedBy {
  id: string
  displayName: string
  username: string
}

export interface ArchiveWorkItem {
  id: string
  orderCode: string | null
  companyName: string
  productName: string
  packagingType: string | null
  orderType: string | null
  orderedQuantity: string | null
  moduleKey: WorkItemModuleKey
  moduleTitle: string
  completedAt: string
  completedBy: ArchiveCompletedBy
}

export interface ArchivePagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ArchiveWorkItemsResponse {
  items: ArchiveWorkItem[]
  pagination: ArchivePagination
}

export type ArchiveSuggestionType = 'company' | 'product' | 'orderCode'

export interface ArchiveSuggestion {
  type: ArchiveSuggestionType
  value: string
}

export interface ArchiveFilters {
  q: string
  moduleKey: WorkItemModuleKey | ''
  completedBy: string
  completedFrom: string
  completedTo: string
  page: number
  pageSize: number
}

export type ArchiveRequestErrorKind =
  | 'unauthorized'
  | 'validation'
  | 'error'

export type ArchiveLoadStatus =
  | 'loading'
  | 'success'
  | 'unauthorized'
  | 'error'
