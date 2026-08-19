import * as path from 'path';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import { nodecg } from '../util/nodecg.js';
import { packsDir } from './config.js';

export const setupPacksServer = () => {
  const router = nodecg.Router();

  router.get('/*', async (req, res) => {
    const urlPath = decodeURIComponent(req.path ?? '/');
    const safe    = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const joinedFile = path.join(packsDir, safe);
    
    const resolvedPacksDir = path.resolve(packsDir);
    const file = path.resolve(joinedFile);

    if (!file.startsWith(resolvedPacksDir)) {
      res.status(403).end();
      return;
    }

    const DEFAULT_SILHOUETTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 24 24" fill="#666666"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

    const mimeTypes: Record<string, string> = {
      '.png':  'image/png',
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.json': 'application/json',
    };
    const ext = path.extname(file).toLowerCase();
    const mimeType = mimeTypes[ext];

    try {
      const stat = await fs.stat(file);
      if (!stat.isFile()) {
        throw new Error('Not a file');
      }

      if (!mimeType) {
        res.status(404).end();
        return;
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      createReadStream(file).pipe(res as NodeJS.WritableStream);
    } catch {
      if (mimeType && mimeType.startsWith('image/')) {
        const parts = safe.split(path.sep).filter(Boolean);
        const packId = parts[0];
        if (packId) {
          const packHero = path.join(packsDir, packId, 'hero.webp');
          try {
            await fs.access(packHero);
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            createReadStream(packHero).pipe(res as NodeJS.WritableStream);
            return;
          } catch {
            // Hero image does not exist, check logo
          }

          const packLogo = path.join(packsDir, packId, 'logo.webp');
          try {
            await fs.access(packLogo);
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            createReadStream(packLogo).pipe(res as NodeJS.WritableStream);
            return;
          } catch {
            // Logo image does not exist, fall back to SVG
          }
        }
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).send(DEFAULT_SILHOUETTE_SVG);
        return;
      }
      res.status(404).end();
    }
  });

  nodecg.mount('/packs', router);
};
