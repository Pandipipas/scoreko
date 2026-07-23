import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { nodecg } from '../util/nodecg.js';
import { packsDir } from './config.js';
import type { PackManifest } from './types.js';
import { getErrorMessage } from '../util/error.js';
import { validatePackId } from './validation.js';

export const verifyPackIntegrity = async (packId: string): Promise<boolean> => {
  if (!validatePackId(packId)) {
    nodecg.log.warn(`[packs] Integrity check failed: invalid packId "${packId}".`);
    return false;
  }

  const packDir = path.join(packsDir, packId);
  const manifestPath = path.join(packDir, 'manifest.json');
  try {
    await fs.access(manifestPath);
  } catch {
    return false;
  }
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as PackManifest;
    await Promise.all(manifest.characters.map(async (char) => {
      const charPath = path.join(packDir, 'characters', `${char.slug}.webp`);
      try {
        await fs.access(charPath);
      } catch {
        throw new Error(`missing image for "${packId}/${char.slug}"`);
      }

      if (char.sha256) {
        const hash = crypto.createHash('sha256').update(await fs.readFile(charPath)).digest('hex');
        if (hash !== char.sha256) {
          throw new Error(`hash mismatch for "${packId}/${char.slug}"`);
        }
      }

      const thumbPath = path.join(packDir, 'characters', `${char.slug}-thumb.webp`);
      if (char.thumbSha256) {
        try {
          await fs.access(thumbPath);
        } catch {
          throw new Error(`missing thumb image for "${packId}/${char.slug}"`);
        }
        const thumbHash = crypto.createHash('sha256').update(await fs.readFile(thumbPath)).digest('hex');
        if (thumbHash !== char.thumbSha256) {
          throw new Error(`thumb hash mismatch for "${packId}/${char.slug}"`);
        }
      }

      if (char.sizeBytes && char.sizeBytes > 0) {
        const stat = await fs.stat(charPath);
        let thumbSize = 0;
        try {
          thumbSize = (await fs.stat(thumbPath)).size;
        } catch {
          // ignore
        }
        const totalSize = stat.size + thumbSize;

        if (totalSize !== char.sizeBytes) {
          throw new Error(`file size mismatch for "${packId}/${char.slug}" (${totalSize} vs ${char.sizeBytes} expected bytes)`);
        }
      }
    }));
    return true;
  } catch (err) {
    nodecg.log.warn(`[packs] Integrity check failed: ${getErrorMessage(err)}`);
    return false;
  }
};
