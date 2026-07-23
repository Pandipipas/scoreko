import type { NodeCGServerAPI } from '../types/index.js';
import { set } from './util/nodecg.js';

export default async (nodecg: NodeCGServerAPI) => {
  
  
  process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    nodecg.log.error(`[core] Unhandled Promise Rejection: ${message}`);
  });

  process.on('uncaughtException', (err: Error) => {
    nodecg.log.error(`[core] Uncaught Exception: ${err.stack ?? err.message}`);
    
    
    
  });

  
  
  set(nodecg);
  await import('./util/replicants.js');
  await Promise.all([
    import('./startgg/index.js'),
    import('./challonge/index.js'),
    import('./packs/index.js'),
  ]);
};
