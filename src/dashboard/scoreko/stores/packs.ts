import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  registerInstalledPack,
  unregisterInstalledPack,
} from '../../../shared/fighting-characters';
import {
  getPackLogoUrl as getPackLogoUrlShared,
  getPackHeroUrl as getPackHeroUrlShared,
  getPackHeaderUrl as getPackHeaderUrlShared,
  getCharacterImageRepoUrl as getCharacterImageRepoUrlShared,
  type PacksConfig,
} from '../../../shared/pack-config';
import type {
  GameSelectOption,
  PackDownloadState,
  PackManifest,
  PackRegistry,
} from '../../../shared/pack-types';
import {
  installedPacksReplicant,
  packRegistryReplicant,
  downloadStatesReplicant,
  availableUpdatesReplicant,
  packsConfigReplicant,
} from '../../../browser_shared/replicants';

export const usePacksStore = defineStore('packs', () => {
  const registry = ref<PackRegistry | null>(null);
  const installedPackIds = ref<string[]>([]);
  const downloadStates = ref<Record<string, PackDownloadState>>({});
  const availableUpdates = ref<Record<string, { installedVersion: string; latestVersion: string }>>({});

  
  const loadedManifestIds = new Set<string>();

  watch(
    () => packRegistryReplicant?.data,
    (val) => {
      registry.value = val ?? null;
    },
    { immediate: true, deep: true },
  );

  watch(
    () => installedPacksReplicant?.data,
    (newVal, oldVal) => {
      const next = newVal ?? [];
      const prev = oldVal ?? [];
      installedPackIds.value = next;

      const added = next.filter((id) => !prev.includes(id));
      for (const id of added) {
        _loadInstalledManifest(id);
      }

      const removed = prev.filter((id) => !next.includes(id));
      for (const id of removed) {
        const gameName = getGameNameById(id);
        unregisterInstalledPack(gameName);
        loadedManifestIds.delete(id);
      }
    },
    { immediate: true, deep: true },
  );

  watch(
    () => downloadStatesReplicant?.data,
    (val) => {
      downloadStates.value = val ?? {};
    },
    { immediate: true, deep: true },
  );

  watch(
    () => availableUpdatesReplicant?.data,
    (val) => {
      availableUpdates.value = val ?? {};
    },
    { immediate: true, deep: true },
  );

  
  const packsConfig = computed<PacksConfig | undefined>(() => packsConfigReplicant?.data);

  
  const updateCount = computed(() => Object.keys(availableUpdates.value).length);

  
  const allGameOptions = computed<GameSelectOption[]>(() => {
    if (!registry.value) return [];
    return registry.value.packs.map((entry) => ({
      label: entry.name,
      value: entry.name,
      available: installedPackIds.value.includes(entry.id),
      registryEntry: entry,
      updateInfo: availableUpdates.value[entry.id],
    }));
  });

  
  function _loadInstalledManifest(packId: string): void {
    if (loadedManifestIds.has(packId)) return;

    nodecg.sendMessage('readLocalManifest', packId, (err: Error | null, result: unknown) => {
      if (err) {
        console.error(`[usePacksStore] Failed to load manifest for "${packId}":`, err);
        return;
      }
      const manifest = result as PackManifest;
      registerInstalledPack(manifest);
      loadedManifestIds.add(packId);
    });
  }

  
  function getGameNameById(packId: string): string {
    return registry.value?.packs.find((p) => p.id === packId)?.name ?? '';
  }

  
  function isGameAvailable(gameName: string): boolean {
    const entry = registry.value?.packs.find((p) => p.name === gameName);
    if (!entry) return false;
    return installedPackIds.value.includes(entry.id);
  }

  
  function getDownloadState(packId: string): PackDownloadState {
    return downloadStates.value[packId] ?? { status: 'idle', progress: 0 };
  }

  
  function getLocalLogoUrl(packId: string): string {
    return `/packs/${packId}/logo.webp`;
  }

  
  function getPackLogoUrl(packId: string): string {
    if (!packsConfig.value) return '';
    return getPackLogoUrlShared(packsConfig.value, packId);
  }

  
  function getLocalHeroUrl(packId: string): string {
    return `/packs/${packId}/hero.webp`;
  }

  
  function getPackHeroUrl(packId: string): string {
    if (!packsConfig.value) return '';
    return getPackHeroUrlShared(packsConfig.value, packId);
  }

  
  function getLocalHeaderUrl(packId: string): string {
    return `/packs/${packId}/header.webp`;
  }

  
  function getPackHeaderUrl(packId: string): string {
    if (!packsConfig.value) return '';
    return getPackHeaderUrlShared(packsConfig.value, packId);
  }

  
  function getCharacterImageRepoUrl(packId: string, slug: string, ext = 'webp'): string {
    if (!packsConfig.value) return '';
    return getCharacterImageRepoUrlShared(packsConfig.value, packId, slug, ext);
  }

  
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  
  function fetchRegistry(): void {
    nodecg.sendMessage('fetchPackRegistry', undefined, (err: Error | null) => {
      if (err) console.error('[usePacksStore] fetchPackRegistry failed:', err);
    });
  }

  
  function downloadPack(packId: string): void {
    nodecg.sendMessage('downloadPack', packId, (err: Error | null) => {
      if (err) console.error(`[usePacksStore] downloadPack "${packId}" failed:`, err);
    });
  }

  
  function uninstallPack(packId: string): void {
    nodecg.sendMessage('uninstallPack', packId, (err: Error | null) => {
      if (err) console.error(`[usePacksStore] uninstallPack "${packId}" failed:`, err);
    });
  }

  
  function updatePack(packId: string): void {
    nodecg.sendMessage('updatePack', packId, (err: Error | null) => {
      if (err) console.error(`[usePacksStore] updatePack "${packId}" failed:`, err);
    });
  }

  
  function cancelPackDownload(packId: string): void {
    nodecg.sendMessage('cancelPackDownload', packId, (err: Error | null) => {
      if (err) console.error(`[usePacksStore] cancelPackDownload "${packId}" failed:`, err);
    });
  }

  return {
    registry,
    installedPackIds,
    downloadStates,
    availableUpdates,
    packsConfig,
    updateCount,
    allGameOptions,
    getGameNameById,
    isGameAvailable,
    getDownloadState,
    getLocalLogoUrl,
    getPackLogoUrl,
    getLocalHeroUrl,
    getPackHeroUrl,
    getLocalHeaderUrl,
    getPackHeaderUrl,
    getCharacterImageRepoUrl,
    formatBytes,
    fetchRegistry,
    downloadPack,
    uninstallPack,
    updatePack,
    cancelPackDownload,
  };
});
