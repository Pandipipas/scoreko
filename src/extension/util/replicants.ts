import type NodeCG from 'nodecg/types';
import type { Schemas } from '../../types/index.js';
import { nodecg } from './nodecg.js';
import { validatePacksUrl } from './helpers.js';

export interface PackRegistry {
  schemaVersion: number;
  updatedAt: string;
  packs: Array<{
    id: string;
    name: string;
    gameVersion: string;
    totalSizeBytes: number;
    logoPath: string;
    characterCount: number;
    palette: { start: string; end: string };
  }>;
}

export interface PackDownloadState {
  status: 'idle' | 'fetching-manifest' | 'downloading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export interface PacksConfig {
  baseUrl: string;
  owner: string;
  repo: string;
  branch: string;
}

function hasDefault<T>(name: string) {
  return nodecg.Replicant<T>(name) as unknown as NodeCG.default.ServerReplicantWithSchemaDefault<T>;
}

export const playersReplicant = hasDefault<Schemas.Players>('players');
export const scoreboardReplicant = hasDefault<Schemas.Scoreboard>('scoreboard');
export const attachedBracketReplicant = hasDefault<Schemas.AttachedBracket>('attachedBracket');

export const commentaryReplicant = nodecg.Replicant<Schemas.Commentary>('commentary', {
  defaultValue: {
    leftCommentator: '',
    leftCommentatorTwitter: '',
    rightCommentator: '',
    rightCommentatorTwitter: '',
  },
  persistent: false,
});

export const installedPacksReplicant = nodecg.Replicant<string[]>('installedPacks', {
  defaultValue: [],
  persistent: true,
});

export const packRegistryReplicant = nodecg.Replicant<PackRegistry | null>('packRegistry', {
  defaultValue: null,
  persistent: true,
});

export const downloadStatesReplicant = nodecg.Replicant<Record<string, PackDownloadState>>('downloadStates', {
  defaultValue: {},
  persistent: false,
});

export const availableUpdatesReplicant = nodecg.Replicant<Record<string, { installedVersion: string; latestVersion: string }>>('availableUpdates', {
  defaultValue: {},
  persistent: false,
});

const defaultBaseUrl = 'https://gitea.panver.cloud/';
let configuredBaseUrl = String(nodecg.bundleConfig.packsRepoBaseUrl ?? defaultBaseUrl).trim();

if (!validatePacksUrl(configuredBaseUrl)) {
  nodecg.log.warn(`[core] Invalid or insecure packsRepoBaseUrl: "${configuredBaseUrl}". Falling back to default.`);
  configuredBaseUrl = defaultBaseUrl;
}

export const packsConfigReplicant = nodecg.Replicant<PacksConfig>('packsConfig', {
  defaultValue: {
    baseUrl: configuredBaseUrl,
    owner: String(nodecg.bundleConfig.packsRepoOwner ?? 'Pandipipas').trim(),
    repo: String(nodecg.bundleConfig.packsRepoName ?? 'scoreko-packs').trim(),
    branch: String(nodecg.bundleConfig.packsRepoBranch ?? 'main').trim(),
  },
  persistent: false,
});
