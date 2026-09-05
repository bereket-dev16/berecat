import { PHASE_01_HOME_DEMO_OVERVIEW } from './home.demo-data.js';
import type { HomeService } from './home.types.js';

export function createHomeService(): HomeService {
  return {
    getOverview() {
      return PHASE_01_HOME_DEMO_OVERVIEW;
    },
  };
}
