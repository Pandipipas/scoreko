import * as path from 'path';
import { packsDir } from './config.js';

export const validatePackId = (packId: string): boolean => {
  if (!/^[a-zA-Z0-9_-]+$/.test(packId)) {
    return false;
  }

  const resolvedPath = path.resolve(packsDir, packId);
  const resolvedBase = path.resolve(packsDir);
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    return false;
  }

  return true;
};
