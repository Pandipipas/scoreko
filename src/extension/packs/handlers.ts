import * as fs from 'fs/promises';
import * as path from 'path';
import { nodecg } from '../util/nodecg.js';
import { getErrorMessage } from '../util/error.js';
import { packRegistryReplicant, installedPacksReplicant, downloadStatesReplicant } from '../util/replicants.js';
import type { PackRegistry } from '../../shared/pack-types.js';
import { checkForUpdates } from './registry.js';
import { packsDir, REGISTRY_URL, getManifestUrl } from './config.js';
import { validatePackId } from './validation.js';
import { type Acknowledgement, reply, type PackManifest } from './types.js';
import { performPackDownload, performPackUninstall, performCancelPackDownload } from './service.js';

export function setupHandlers() {
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

    try {
      await performPackDownload(packId, { isUpdate: false }, ack);
    } catch (err) {
      const message = getErrorMessage(err);
      nodecg.log.error(`[packs] Unexpected error in downloadPack: ${message}`);
      reply(ack, new Error(message));
    }
  });

  nodecg.listenFor('cancelPackDownload', (packId: unknown, ack: Acknowledgement | undefined) => {
    try {
      if (typeof packId !== 'string' || !packId || !validatePackId(packId)) {
        return reply(ack, new Error('cancelPackDownload requires a valid non-empty packId.'));
      }
      const cancelled = performCancelPackDownload(packId);
      if (cancelled) {
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
      await performPackUninstall(packId);
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

    try {
      await performPackDownload(packId, { isUpdate: true }, ack);
    } catch (err) {
      const message = getErrorMessage(err);
      nodecg.log.error(`[packs] Unexpected error in updatePack: ${message}`);
      reply(ack, new Error(message));
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
}
