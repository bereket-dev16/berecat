export interface HomeAssignee {
  id: string;
  displayName: string;
}

export interface HomeItem {
  id: string;
  title: string;
  companyName: string;
  description: string | null;
  dueDate: string | null;
  status: 'active' | 'completed';
  completedAt: string | null;
  assignees: HomeAssignee[];
}

export interface HomeModule {
  id: string;
  title: string;
  items: HomeItem[];
}

export interface HomeOverview {
  modules: HomeModule[];
}

export interface HomeService {
  getOverview(): Promise<HomeOverview>;
}
