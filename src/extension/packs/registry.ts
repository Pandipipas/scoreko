import * as fs from 'fs/promises';
import * as path from 'path';
import { nodecg } from '../util/nodecg.js';
import { packsDir } from './config.js';
import type { PackManifest } from './types.js';
import { packRegistryReplicant, installedPacksReplicant, availableUpdatesReplicant } from '../util/replicants.js';
import { validatePackId } from './validation.js';

export const checkForUpdates = async (): Promise<void> => {
  const registry = packRegistryReplicant.value;
  const installed = installedPacksReplicant.value ?? [];

  if (!registry || installed.length === 0) {
    availableUpdatesReplicant.value = {};
    return;
  }

  const updates: Record<string, { installedVersion: string; latestVersion: string }> = {};

  for (const packId of installed) {
    if (!validatePackId(packId)) continue;
    const registryEntry = registry.packs.find((p) => p.id === packId);
    if (!registryEntry) continue;

    const manifestPath = path.join(packsDir, packId, 'manifest.json');
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as PackManifest;
      if (manifest.gameVersion !== registryEntry.gameVersion) {
        updates[packId] = {
          installedVersion: manifest.gameVersion,
          latestVersion: registryEntry.gameVersion,
        };
        nodecg.log.info(
          `[packs] Update available for "${packId}": ${manifest.gameVersion} → ${registryEntry.gameVersion}`,
        );
      }
    } catch {
      // ignore
    }
  }

  availableUpdatesReplicant.value = updates;
};
