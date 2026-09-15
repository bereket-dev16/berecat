import type { UserRole, UserTeam } from '../auth/auth-types'
import type { WorkItemModuleKey } from './work-item-constants'

export interface UserOption {
  id: string
  username: string
  displayName: string
  role: UserRole
  team: UserTeam
}

export interface WorkItemAssignee {
  id: string
  displayName: string
  username: string
  team: UserTeam
}

export interface WorkItemCreator {
  id: string
  displayName: string
  username: string
}

export interface WorkItemCommentAuthor {
  id: string
  displayName: string
  username: string
}

export interface WorkItemCommentContent {
  id: string
  body: string
  createdAt: string
  author: WorkItemCommentAuthor
}

export interface WorkItemReply extends WorkItemCommentContent {
  reactionCount: number
  reactedByCurrentUser: boolean
}

export interface WorkItemComment extends WorkItemReply {
  replies: WorkItemReply[]
}

export interface CreatedWorkItemComment extends WorkItemCommentContent {
  parentCommentId: string | null
}

export type WorkItemStatus = 'active' | 'completed'
export type WorkItemEventType = 'moved' | 'completed' | 'reopened'

export interface WorkItemEvent {
  id: string
  type: WorkItemEventType
  createdAt: string
  actor: WorkItemCreator
  fromModuleKey: WorkItemModuleKey | null
  fromModuleTitle: string | null
  toModuleKey: WorkItemModuleKey | null
  toModuleTitle: string | null
}

export interface WorkItemDetail {
  id: string
  moduleKey: WorkItemModuleKey
  moduleTitle: string
  orderCode: string | null
  companyName: string
  productName: string
  packagingType: string | null
  supplierCompany: string | null
  orderType: string | null
  stockValue: string | null
  needOrderValue: string | null
  orderedQuantity: string | null
  receivedQuantity: string | null
  orderReceivedDate: string | null
  orderPlacedDate: string | null
  orderDeadlineDate: string | null
  orderShipmentDate: string | null
  processStage: string | null
  productDetail: string | null
  status: WorkItemStatus
  completedAt: string | null
  completedBy: WorkItemCreator | null
  assignees: WorkItemAssignee[]
  createdBy: WorkItemCreator
  createdAt: string
  updatedAt: string
  comments: WorkItemComment[]
  events: WorkItemEvent[]
}

export interface CreateWorkItemInput {
  moduleKey: WorkItemModuleKey
  orderCode: string | null
  companyName: string
  productName: string
  packagingType: string | null
  supplierCompany: string | null
  orderType: string | null
  stockValue: string | null
  needOrderValue: string | null
  orderedQuantity: string | null
  receivedQuantity: string | null
  orderReceivedDate: string | null
  orderPlacedDate: string | null
  orderDeadlineDate: string | null
  orderShipmentDate: string | null
  processStage: string | null
  productDetail: string | null
  assigneeIds: string[]
}

export type UpdateWorkItemInput = Omit<CreateWorkItemInput, 'moduleKey'>

export interface WorkItemCommentReactionResult {
  reactionCount: number
  reactedByCurrentUser: boolean
}

export type WorkItemRequestErrorKind =
  | 'unauthorized'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'error'

export type WorkItemLoadStatus =
  | 'loading'
  | 'success'
  | 'not-found'
  | 'unauthorized'
  | 'error'

export type UserOptionsStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'unauthorized'
  | 'error'
