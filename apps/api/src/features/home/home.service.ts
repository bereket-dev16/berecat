import type { HomeService } from './home.types.js';
import { WORK_MODULES } from '../work-items/work-item.constants.js';
import type { WorkItemRepository } from '../work-items/work-item.types.js';

export function createHomeService(
  repository: Pick<WorkItemRepository, 'listHomeItems'>,
): HomeService {
  return {
    async getOverview() {
      const storedItems = await repository.listHomeItems();

      return {
        modules: WORK_MODULES.map((module) => ({
          id: module.key,
          title: module.title,
          items: storedItems
            .filter((item) => item.moduleKey === module.key)
            .map((item) => ({
              id: item.id,
              title: item.title,
              companyName: item.companyName,
              description: item.description,
              dueDate: item.dueDate,
              status: item.status,
              completedAt: item.completedAt,
              assignees: item.assignees,
            })),
        })),
      };
    },
  };
}
