import { setupHandlers } from './handlers.js';
import { initializePacksService } from './service.js';

export const setupPacks = async () => {
  await initializePacksService();
  setupHandlers();
};

setupPacks();
