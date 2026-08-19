import * as path from 'path';
import { packsDir } from './config.js';

export const validatePackId = (packId: string): boolean => {
  if (typeof packId !== 'string') return false;
  if (packId.includes('\0')) return false;

  try {
    const decodedPackId = decodeURIComponent(packId);
    if (decodedPackId !== packId) return false;
  } catch {
    return false;
  }

  const normalizedPackId = packId.normalize('NFC');

  if (path.isAbsolute(normalizedPackId)) return false;

  if (!/^[a-zA-Z0-9_-]+$/.test(normalizedPackId)) {
    return false;
  }

  const resolvedPath = path.resolve(packsDir, normalizedPackId);
  const resolvedBase = path.resolve(packsDir);
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    return false;
  }
  
  if (resolvedPath === resolvedBase) {
    return false;
  }

  return true;
};
