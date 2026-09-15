import type { WorkItemModuleKey } from '../work-items/work-item-constants'

export interface HomeAssignee {
  id: string
  displayName: string
}

export interface HomeItem {
  id: string
  title: string
  companyName: string
  description: string | null
  dueDate: string | null
  status: 'active' | 'completed'
  completedAt: string | null
  assignees: HomeAssignee[]
}

export interface HomeModule {
  id: WorkItemModuleKey
  title: string
  items: HomeItem[]
}

export interface HomeOverview {
  modules: HomeModule[]
}

export type HomeOverviewStatus =
  | 'loading'
  | 'success'
  | 'error'
  | 'unauthorized'
