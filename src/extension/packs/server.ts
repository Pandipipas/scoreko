import * as fs from 'fs';
import * as path from 'path';
import { nodecg } from '../util/nodecg.js';
import { packsDir } from './config.js';

export const setupPacksServer = () => {
  const router = nodecg.Router();

  router.get('/*', (req, res) => {
    const urlPath = decodeURIComponent(req.path ?? '/');
    const safe    = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const joinedFile = path.join(packsDir, safe);
    
    const resolvedPacksDir = path.resolve(packsDir);
    const file = path.resolve(joinedFile);

    if (!file.startsWith(resolvedPacksDir)) {
      res.status(403).end();
      return;
    }

    fs.stat(file, (statErr, stat) => {
      if (statErr || !stat.isFile()) {
        res.status(404).end();
        return;
      }
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

      if (!mimeType) {
        res.status(404).end();
        return;
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(file).pipe(res as NodeJS.WritableStream);
    });
  });

  nodecg.mount('/packs', router);
};
