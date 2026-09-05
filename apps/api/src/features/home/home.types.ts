export interface HomeAssignee {
  id: string;
  displayName: string;
}

export interface HomeItem {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  assignees: readonly HomeAssignee[];
}

export interface HomeModule {
  id: string;
  title: string;
  items: readonly HomeItem[];
}

export interface HomeOverview {
  modules: readonly HomeModule[];
}

export interface HomeService {
  getOverview(): HomeOverview;
}
