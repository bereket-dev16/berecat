export interface HomeAssignee {
  id: string
  displayName: string
}

export interface HomeItem {
  id: string
  title: string
  description: string
  dueDate: string
  assignees: HomeAssignee[]
}

export interface HomeModule {
  id: string
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
