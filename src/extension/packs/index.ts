import * as fs from 'fs/promises';
import * as path from 'path';
import { nodecg } from '../util/nodecg.js';
import { getErrorMessage } from '../util/error.js';
import { installedPacksReplicant, packRegistryReplicant, downloadStatesReplicant, availableUpdatesReplicant, type PackRegistry } from '../util/replicants.js';
import { setupPacksServer } from './server.js';
import { verifyPackIntegrity } from './integrity.js';
import { checkForUpdates } from './registry.js';
import { setDownloadState, activeDownloads, fetchBuffer, trySaveImage } from './downloader.js';
import { packsDir, REGISTRY_URL, getManifestUrl, getPackLogoUrl, getPackHeroUrl, getPackHeaderUrl, getCharacterImageRepoUrl } from './config.js';
import { validatePackId } from './validation.js';
import { type Acknowledgement, reply, type PackManifest } from './types.js';

const IMAGE_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'avif'] as const;

export const setupPacks = async () => {
  await fs.mkdir(packsDir, { recursive: true });
  fetch(REGISTRY_URL)
    .then((res) => {
      if (res.ok) {
        nodecg.log.info('[packs] Mounted pack-manager extension');
      } else {
        nodecg.log.warn(`[packs] Failed to connect pack-manager extension (${res.status})`);
      }
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      nodecg.log.warn(`[packs] Failed to connect pack-manager extension (${message})`);
    });

  setupPacksServer();

  nodecg.listenFor('fetchPackRegistry', async (_data: unknown, ack: Acknowledgement | undefined) => {
    try {
      const response = await fetch(REGISTRY_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const registry = await response.json() as PackRegistry;
      packRegistryReplicant.value = registry;
      await checkForUpdates();
      reply(ack, null, registry);
    } catch (err) {
      const message = getErrorMessage(err);
      nodecg.log.error(`[packs] Failed to fetch registry: ${message}`);
      reply(ack, new Error(message));
    }
  });

  nodecg.listenFor('downloadPack', async (packId: unknown, ack: Acknowledgement | undefined) => {
    if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
      return reply(ack, new Error('downloadPack requires a valid non-empty packId.'));
    }
    if (installedPacksReplicant.value?.includes(packId)) {
      return reply(ack, null, { alreadyInstalled: true });
    }
    if (downloadStatesReplicant.value?.[packId]?.status === 'downloading') {
      return reply(ack, new Error(`Pack "${packId}" is already downloading.`));
    }

    setDownloadState(packId, { status: 'fetching-manifest', progress: 0, error: undefined });

    const controller = new AbortController();
    activeDownloads.set(packId, controller);
    const signal = controller.signal;

    try {
      const manifestRes = await fetch(getManifestUrl(packId), { signal });
      if (!manifestRes.ok) throw new Error(`Cannot fetch manifest: HTTP ${manifestRes.status}`);
      const manifest = await manifestRes.json() as PackManifest;

      const packDir  = path.join(packsDir, packId);
      const charsDir = path.join(packDir, 'characters');
      if (signal.aborted) throw new Error('Aborted');
      await fs.mkdir(charsDir, { recursive: true });
      await fs.writeFile(path.join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      setDownloadState(packId, { status: 'downloading', progress: 2 });
      try {
        const logoBuffer = await fetchBuffer(getPackLogoUrl(packId), signal);
        if (signal.aborted) throw new Error('Aborted');
        await fs.writeFile(path.join(packDir, 'logo.webp'), logoBuffer);
      } catch (logoErr) {
        if (signal.aborted || (logoErr instanceof Error && logoErr.name === 'AbortError')) throw logoErr;
        nodecg.log.warn(`[packs] No logo found for "${packId}" — skipping.`);
      }

      try {
        const heroBuffer = await fetchBuffer(getPackHeroUrl(packId), signal);
        if (signal.aborted) throw new Error('Aborted');
        await fs.writeFile(path.join(packDir, 'hero.webp'), heroBuffer);
      } catch (heroErr) {
        if (signal.aborted || (heroErr instanceof Error && heroErr.name === 'AbortError')) throw heroErr;
        nodecg.log.warn(`[packs] No hero image found for "${packId}" — skipping.`);
      }

      try {
        const headerBuffer = await fetchBuffer(getPackHeaderUrl(packId), signal);
        if (signal.aborted) throw new Error('Aborted');
        await fs.writeFile(path.join(packDir, 'header.webp'), headerBuffer);
      } catch (headerErr) {
        if (signal.aborted || (headerErr instanceof Error && headerErr.name === 'AbortError')) throw headerErr;
        nodecg.log.warn(`[packs] No header image found for "${packId}" — skipping.`);
      }

      const total = manifest.characters.length;
      for (let i = 0; i < total; i++) {
        if (signal.aborted) throw new Error('Aborted');
        const char = manifest.characters[i]!;
        const saved = await trySaveImage(
          charsDir,
          char.slug,
          IMAGE_EXTENSIONS,
          (ext, suffix) => getCharacterImageRepoUrl(packId, char.slug, ext, suffix),
          signal,
          char.sizeBytes,
          char.sha256,
          char.thumbSha256,
        );
        if (!saved) {
          nodecg.log.warn(`[packs] No image for "${packId}/${char.slug}" — placeholder will be used.`);
        }
        setDownloadState(packId, { progress: 5 + Math.round(((i + 1) / total) * 93) });
      }

      if (signal.aborted) throw new Error('Aborted');
      const current = installedPacksReplicant.value ?? [];
      if (!current.includes(packId)) installedPacksReplicant.value = [...current, packId];

      setDownloadState(packId, { status: 'done', progress: 100 });
      activeDownloads.delete(packId);
      reply(ack, null, { packId, characterCount: manifest.characters.length });
    } catch (err) {
      activeDownloads.delete(packId);
      const isAborted = signal.aborted || (err instanceof Error && err.name === 'AbortError');
      if (isAborted) {
        nodecg.log.info(`[packs] Download of "${packId}" cancelled by the user.`);
        const packDir = path.join(packsDir, packId);
        try {
          await fs.rm(packDir, { recursive: true, force: true });
        } catch (rmErr) {
          nodecg.log.error(`[packs] Error cleaning up directory after cancel: ${getErrorMessage(rmErr)}`);
        }
        installedPacksReplicant.value = (installedPacksReplicant.value ?? []).filter((id) => id !== packId);
        setDownloadState(packId, { status: 'idle', progress: 0, error: undefined });
        reply(ack, new Error('Download cancelled by the user.'));
      } else {
        const message = getErrorMessage(err);
        nodecg.log.error(`[packs] Error downloading "${packId}": ${message}`);
        setDownloadState(packId, { status: 'error', error: message });
        reply(ack, new Error(message));
      }
    }
  });

  nodecg.listenFor('cancelPackDownload', (packId: unknown, ack: Acknowledgement | undefined) => {
    try {
      if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
        return reply(ack, new Error('cancelPackDownload requires a valid non-empty packId.'));
      }
      const controller = activeDownloads.get(packId);
      if (controller) {
        controller.abort();
        activeDownloads.delete(packId);
        reply(ack, null);
      } else {
        reply(ack, new Error(`No active download for pack "${packId}".`));
      }
    } catch (err) {
      const message = getErrorMessage(err);
      nodecg.log.error(`[packs] Unexpected error in cancelPackDownload: ${message}`);
      reply(ack, new Error(message));
    }
  });

  nodecg.listenFor('uninstallPack', async (packId: unknown, ack: Acknowledgement | undefined) => {
    if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
      return reply(ack, new Error('uninstallPack requires a valid non-empty packId.'));
    }
    try {
      await fs.rm(path.join(packsDir, packId), { recursive: true, force: true });
      installedPacksReplicant.value = (installedPacksReplicant.value ?? []).filter((id) => id !== packId);
      const states = { ...downloadStatesReplicant.value };
      delete states[packId];
      downloadStatesReplicant.value = states;
      const updates = { ...availableUpdatesReplicant.value };
      delete updates[packId];
      availableUpdatesReplicant.value = updates;
      reply(ack, null);
    } catch (err) {
      const message = getErrorMessage(err);
      nodecg.log.error(`[packs] Error uninstalling "${packId}": ${message}`);
      reply(ack, new Error(message));
    }
  });

  nodecg.listenFor('updatePack', async (packId: unknown, ack: Acknowledgement | undefined) => {
    if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
      return reply(ack, new Error('updatePack requires a valid non-empty packId.'));
    }
    if (!installedPacksReplicant.value?.includes(packId)) {
      return reply(ack, new Error(`Pack "${packId}" is not installed. Use downloadPack first.`));
    }
    if (downloadStatesReplicant.value?.[packId]?.status === 'downloading') {
      return reply(ack, new Error(`Pack "${packId}" is already being updated.`));
    }

    setDownloadState(packId, { status: 'fetching-manifest', progress: 0, error: undefined });

    const controller = new AbortController();
    activeDownloads.set(packId, controller);
    const signal = controller.signal;

    try {
      const manifestRes = await fetch(getManifestUrl(packId), { signal });
      if (!manifestRes.ok) throw new Error(`Cannot fetch manifest: HTTP ${manifestRes.status}`);
      const manifest = await manifestRes.json() as PackManifest;

      const packDir  = path.join(packsDir, packId);
      const charsDir = path.join(packDir, 'characters');

      if (signal.aborted) throw new Error('Aborted');

      try {
        await fs.access(charsDir);
        await fs.rm(charsDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      await fs.mkdir(charsDir, { recursive: true });
      await fs.writeFile(path.join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      setDownloadState(packId, { status: 'downloading', progress: 2 });
      try {
        const logoBuffer = await fetchBuffer(getPackLogoUrl(packId), signal);
        if (signal.aborted) throw new Error('Aborted');
        await fs.writeFile(path.join(packDir, 'logo.webp'), logoBuffer);
      } catch (logoErr) {
        if (signal.aborted || (logoErr instanceof Error && logoErr.name === 'AbortError')) throw logoErr;
        nodecg.log.warn(`[packs] No logo found for "${packId}" — skipping.`);
      }

      try {
        const heroBuffer = await fetchBuffer(getPackHeroUrl(packId), signal);
        if (signal.aborted) throw new Error('Aborted');
        await fs.writeFile(path.join(packDir, 'hero.webp'), heroBuffer);
      } catch (heroErr) {
        if (signal.aborted || (heroErr instanceof Error && heroErr.name === 'AbortError')) throw heroErr;
        nodecg.log.warn(`[packs] No hero image found for "${packId}" — skipping.`);
      }

      try {
        const headerBuffer = await fetchBuffer(getPackHeaderUrl(packId), signal);
        if (signal.aborted) throw new Error('Aborted');
        await fs.writeFile(path.join(packDir, 'header.webp'), headerBuffer);
      } catch (headerErr) {
        if (signal.aborted || (headerErr instanceof Error && headerErr.name === 'AbortError')) throw headerErr;
        nodecg.log.warn(`[packs] No header image found for "${packId}" — skipping.`);
      }

      const total = manifest.characters.length;
      for (let i = 0; i < total; i++) {
        if (signal.aborted) throw new Error('Aborted');
        const char = manifest.characters[i]!;
        const saved = await trySaveImage(
          charsDir,
          char.slug,
          IMAGE_EXTENSIONS,
          (ext, suffix) => getCharacterImageRepoUrl(packId, char.slug, ext, suffix),
          signal,
          char.sizeBytes,
          char.sha256,
          char.thumbSha256,
        );
        if (!saved) {
          nodecg.log.warn(`[packs] No image for "${packId}/${char.slug}" — placeholder will be used.`);
        }
        setDownloadState(packId, { progress: 5 + Math.round(((i + 1) / total) * 93) });
      }

      const updates = { ...availableUpdatesReplicant.value };
      delete updates[packId];
      availableUpdatesReplicant.value = updates;

      setDownloadState(packId, { status: 'done', progress: 100 });
      nodecg.log.info(`[packs] Pack "${packId}" updated to v${manifest.gameVersion}.`);
      activeDownloads.delete(packId);
      reply(ack, null, { packId, version: manifest.gameVersion });
    } catch (err) {
      activeDownloads.delete(packId);
      const isAborted = signal.aborted || (err instanceof Error && err.name === 'AbortError');
      if (isAborted) {
        nodecg.log.info(`[packs] Update of "${packId}" cancelled by the user.`);
        const packDir = path.join(packsDir, packId);
        try {
          await fs.rm(packDir, { recursive: true, force: true });
        } catch (rmErr) {
          nodecg.log.error(`[packs] Error cleaning up directory after cancelled update: ${getErrorMessage(rmErr)}`);
        }
        installedPacksReplicant.value = (installedPacksReplicant.value ?? []).filter((id) => id !== packId);
        setDownloadState(packId, { status: 'idle', progress: 0, error: undefined });
        reply(ack, new Error('Update cancelled by the user.'));
      } else {
        const message = getErrorMessage(err);
        nodecg.log.error(`[packs] Error updating "${packId}": ${message}`);
        setDownloadState(packId, { status: 'error', error: message });
        reply(ack, new Error(message));
      }
    }
  });

  nodecg.listenFor('readLocalManifest', async (packId: unknown, ack: Acknowledgement | undefined) => {
    if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
      return reply(ack, new Error('readLocalManifest requires a valid non-empty packId.'));
    }
    const manifestPath = path.join(packsDir, packId, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      reply(ack, null, JSON.parse(raw) as PackManifest);
    } catch (err) {
      const message = getErrorMessage(err);
      reply(ack, new Error(`Cannot read manifest for "${packId}": ${message}`));
    }
  });

  nodecg.listenFor('getPackManifest', async (packId: unknown, ack: Acknowledgement | undefined) => {
    if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
      return reply(ack, new Error('getPackManifest requires a valid non-empty packId.'));
    }
    
    const manifestPath = path.join(packsDir, packId, 'manifest.json');
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      return reply(ack, null, JSON.parse(raw) as PackManifest);
    } catch {
      // ignore
    }

    try {
      const manifestRes = await fetch(getManifestUrl(packId));
      if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status}`);
      const manifest = await manifestRes.json() as PackManifest;
      reply(ack, null, manifest);
    } catch (err) {
      const message = getErrorMessage(err);
      nodecg.log.error(`[packs] Error fetching remote manifest for "${packId}": ${message}`);
      reply(ack, new Error(message));
    }
  });

  nodecg.listenFor('getRemotePackManifest', async (packId: unknown, ack: Acknowledgement | undefined) => {
    if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
      return reply(ack, new Error('getRemotePackManifest requires a valid non-empty packId.'));
    }
    try {
      const manifestRes = await fetch(getManifestUrl(packId));
      if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status}`);
      const manifest = await manifestRes.json() as PackManifest;
      reply(ack, null, manifest);
    } catch (err) {
      const message = getErrorMessage(err);
      reply(ack, new Error(`Cannot fetch remote manifest for "${packId}": ${message}`));
    }
  });

  const installedAtStart = installedPacksReplicant.value ?? [];
  const results = await Promise.allSettled(
    installedAtStart.map(async (id) => ({ id, ok: await verifyPackIntegrity(id) })),
  );
  const verified = results
    .filter((r): r is PromiseFulfilledResult<{ id: string; ok: boolean }> => r.status === 'fulfilled' && r.value.ok)
    .map((r) => r.value.id);
  if (verified.length !== installedAtStart.length) {
    nodecg.log.warn('[packs] Some installed packs failed the integrity check and have been removed.');
    installedPacksReplicant.value = verified;
  }

  await checkForUpdates();
};

setupPacks();
