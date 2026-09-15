import type {
  PublicUser,
  UserRole,
  UserTeam,
} from '../auth/auth.types.js';
import type { HomeItem } from '../home/home.types.js';
import type {
  WorkItemEventType,
  WorkItemStatus,
  WorkModuleKey,
} from './work-item.constants.js';

export interface UserOption {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  team: UserTeam;
}

export interface WorkItemAssignee {
  id: string;
  username: string;
  displayName: string;
  team: UserTeam;
}

export interface WorkItemCreator {
  id: string;
  username: string;
  displayName: string;
}

export interface WorkItemCommentReply {
  id: string;
  body: string;
  createdAt: string;
  author: WorkItemCreator;
  reactionCount: number;
  reactedByCurrentUser: boolean;
}

export interface WorkItemComment extends WorkItemCommentReply {
  replies: WorkItemCommentReply[];
}

export interface CreatedWorkItemComment extends WorkItemCommentReply {
  parentCommentId: string | null;
}

export interface WorkItemEvent {
  id: string;
  type: WorkItemEventType;
  createdAt: string;
  actor: WorkItemCreator;
  fromModuleKey: WorkModuleKey | null;
  fromModuleTitle: string | null;
  toModuleKey: WorkModuleKey | null;
  toModuleTitle: string | null;
}

export interface CreateWorkItemInput {
  moduleKey: string;
  orderCode?: string | null;
  companyName: string;
  productName: string;
  packagingType?: string | null;
  supplierCompany?: string | null;
  orderType?: string | null;
  stockValue?: string | null;
  needOrderValue?: string | null;
  orderedQuantity?: string | null;
  receivedQuantity?: string | null;
  orderReceivedDate?: string | null;
  orderPlacedDate?: string | null;
  orderDeadlineDate?: string | null;
  orderShipmentDate?: string | null;
  processStage?: string | null;
  productDetail?: string | null;
  assigneeIds?: string[];
}

export type UpdateWorkItemInput = Omit<CreateWorkItemInput, 'moduleKey'>;

export interface NormalizedCreateWorkItemInput {
  moduleKey: WorkModuleKey;
  orderCode: string | null;
  companyName: string;
  productName: string;
  packagingType: string | null;
  supplierCompany: string | null;
  orderType: string | null;
  stockValue: string | null;
  needOrderValue: string | null;
  orderedQuantity: string | null;
  receivedQuantity: string | null;
  orderReceivedDate: string | null;
  orderPlacedDate: string | null;
  orderDeadlineDate: string | null;
  orderShipmentDate: string | null;
  processStage: string | null;
  productDetail: string | null;
  assigneeIds: string[];
}

export type NormalizedUpdateWorkItemInput = Omit<
  NormalizedCreateWorkItemInput,
  'moduleKey'
>;

export interface WorkItemSummary {
  id: string;
  moduleKey: WorkModuleKey;
  title: string;
  companyName: string;
  description: string | null;
  dueDate: string | null;
  status: WorkItemStatus;
  completedAt: string | null;
  assignees: WorkItemAssignee[];
}

export interface WorkItemDetail {
  id: string;
  moduleKey: WorkModuleKey;
  moduleTitle: string;
  orderCode: string | null;
  companyName: string;
  productName: string;
  packagingType: string | null;
  supplierCompany: string | null;
  orderType: string | null;
  stockValue: string | null;
  needOrderValue: string | null;
  orderedQuantity: string | null;
  receivedQuantity: string | null;
  orderReceivedDate: string | null;
  orderPlacedDate: string | null;
  orderDeadlineDate: string | null;
  orderShipmentDate: string | null;
  processStage: string | null;
  productDetail: string | null;
  status: WorkItemStatus;
  completedAt: string | null;
  completedBy: WorkItemCreator | null;
  assignees: WorkItemAssignee[];
  createdBy: WorkItemCreator;
  createdAt: string;
  updatedAt: string;
  comments: WorkItemComment[];
  events: WorkItemEvent[];
}

export interface StoredHomeItem extends HomeItem {
  moduleKey: WorkModuleKey;
}

export type CreateWorkItemResult =
  | { status: 'created'; workItem: WorkItemSummary }
  | { status: 'invalid-assignees' };

export type UpdateWorkItemResult =
  | { status: 'updated'; workItem: WorkItemSummary }
  | { status: 'not-found' }
  | { status: 'completed' }
  | { status: 'invalid-assignees' };

export type DeleteWorkItemResult =
  | { status: 'deleted' }
  | { status: 'not-found' }
  | { status: 'completed' };

export interface CommentReactionState {
  reactionCount: number;
  reactedByCurrentUser: boolean;
}

export type ChangeCommentReactionResult =
  | { status: 'updated'; reaction: CommentReactionState }
  | { status: 'not-found' }
  | { status: 'comment-not-found' };

export type ReplaceAssigneesResult =
  | { status: 'updated'; assignees: WorkItemAssignee[] }
  | { status: 'not-found' }
  | { status: 'completed' }
  | { status: 'invalid-assignees' };

export type ClaimWorkItemResult =
  | { status: 'claimed'; assignees: WorkItemAssignee[] }
  | { status: 'not-found' }
  | { status: 'completed' }
  | { status: 'wrong-module' }
  | { status: 'conflict' };

export type MoveWorkItemResult =
  | { status: 'moved'; workItem: WorkItemSummary }
  | { status: 'not-found' }
  | { status: 'completed' }
  | { status: 'same-module' };

export type CompleteWorkItemResult =
  | { status: 'completed'; workItem: WorkItemSummary }
  | { status: 'not-found' };

export type ReopenWorkItemResult =
  | { status: 'reopened'; workItem: WorkItemSummary }
  | { status: 'not-found' };

export type AddCommentResult =
  | { status: 'created'; comment: CreatedWorkItemComment }
  | { status: 'not-found' }
  | { status: 'parent-not-found' }
  | { status: 'parent-work-item-mismatch' }
  | { status: 'nested-reply' };

export interface ArchiveWorkItemsQueryInput {
  q?: string;
  moduleKey?: string;
  completedBy?: string;
  completedFrom?: string;
  completedTo?: string;
  page?: number;
  pageSize?: number;
}

export interface NormalizedArchiveWorkItemsQuery {
  q: string | null;
  moduleKey: WorkModuleKey | null;
  completedBy: string | null;
  completedFrom: string | null;
  completedTo: string | null;
  page: number;
  pageSize: number;
}

export interface ArchiveWorkItem {
  id: string;
  orderCode: string | null;
  companyName: string;
  productName: string;
  packagingType: string | null;
  orderType: string | null;
  orderedQuantity: string | null;
  moduleKey: WorkModuleKey;
  moduleTitle: string;
  completedAt: string;
  completedBy: WorkItemCreator;
}

export interface ArchivePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ArchiveWorkItemList {
  items: ArchiveWorkItem[];
  pagination: ArchivePagination;
}

export type ArchiveSuggestionType = 'company' | 'product' | 'orderCode';

export interface ArchiveSuggestion {
  type: ArchiveSuggestionType;
  value: string;
}

export interface WorkItemRepository {
  listActiveUserOptions(): Promise<UserOption[]>;
  listHomeItems(): Promise<StoredHomeItem[]>;
  createWithAssignees(
    input: NormalizedCreateWorkItemInput,
    createdBy: string,
  ): Promise<CreateWorkItemResult>;
  findDetail(
    workItemId: string,
    currentUserId: string,
  ): Promise<WorkItemDetail | null>;
  updateWithAssignees(
    workItemId: string,
    input: NormalizedUpdateWorkItemInput,
    updatedBy: string,
  ): Promise<UpdateWorkItemResult>;
  softDelete(
    workItemId: string,
    deletedBy: string,
  ): Promise<DeleteWorkItemResult>;
  replaceAssignees(
    workItemId: string,
    userIds: string[],
    assignedBy: string,
  ): Promise<ReplaceAssigneesResult>;
  claim(
    workItemId: string,
    user: PublicUser,
  ): Promise<ClaimWorkItemResult>;
  move(
    workItemId: string,
    moduleKey: WorkModuleKey,
    actorId: string,
  ): Promise<MoveWorkItemResult>;
  complete(
    workItemId: string,
    actorId: string,
  ): Promise<CompleteWorkItemResult>;
  reopen(
    workItemId: string,
    actorId: string,
  ): Promise<ReopenWorkItemResult>;
  addComment(
    workItemId: string,
    body: string,
    parentCommentId: string | null,
    author: PublicUser,
  ): Promise<AddCommentResult>;
  addCommentReaction(
    workItemId: string,
    commentId: string,
    userId: string,
  ): Promise<ChangeCommentReactionResult>;
  removeCommentReaction(
    workItemId: string,
    commentId: string,
    userId: string,
  ): Promise<ChangeCommentReactionResult>;
  listArchiveWorkItems(
    query: NormalizedArchiveWorkItemsQuery,
  ): Promise<ArchiveWorkItemList>;
  listArchiveSuggestions(query: string): Promise<ArchiveSuggestion[]>;
}

export type WorkItemServiceResult<T> =
  | { status: 'success'; value: T }
  | {
      status: 'invalid';
      message: string;
    }
  | { status: 'not-found' }
  | { status: 'conflict'; message: string };

export interface WorkItemService {
  listUserOptions(): Promise<UserOption[]>;
  createWorkItem(
    input: CreateWorkItemInput,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemSummary>>;
  getWorkItem(
    workItemId: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemDetail>>;
  updateWorkItem(
    workItemId: string,
    input: UpdateWorkItemInput,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemSummary>>;
  deleteWorkItem(
    workItemId: string,
    confirmation: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<undefined>>;
  replaceAssignees(
    workItemId: string,
    userIds: string[],
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemAssignee[]>>;
  claimWorkItem(
    workItemId: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemAssignee[]>>;
  moveWorkItem(
    workItemId: string,
    moduleKey: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemSummary>>;
  completeWorkItem(
    workItemId: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemSummary>>;
  reopenWorkItem(
    workItemId: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<WorkItemSummary>>;
  addComment(
    workItemId: string,
    body: string,
    parentCommentId: string | null | undefined,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<CreatedWorkItemComment>>;
  addCommentReaction(
    workItemId: string,
    commentId: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<CommentReactionState>>;
  removeCommentReaction(
    workItemId: string,
    commentId: string,
    user: PublicUser,
  ): Promise<WorkItemServiceResult<CommentReactionState>>;
  getArchiveWorkItems(
    query: ArchiveWorkItemsQueryInput,
  ): Promise<WorkItemServiceResult<ArchiveWorkItemList>>;
  getArchiveSuggestions(
    query: string,
  ): Promise<WorkItemServiceResult<ArchiveSuggestion[]>>;
}
