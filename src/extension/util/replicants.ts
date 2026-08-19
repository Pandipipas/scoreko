import type NodeCG from 'nodecg/types';
import type { Schemas } from '../../types/index.js';
import { nodecg } from './nodecg.js';
import { validatePacksUrl } from './helpers.js';
import { DEFAULT_PACKS_REPO_BASE_URL } from '../../shared/constants.js';

import type { PackRegistry, PackDownloadState, PacksConfig } from '../../shared/pack-types.js';

function hasDefault<T>(name: string) {
  return nodecg.Replicant<T>(name) as unknown as NodeCG.default.ServerReplicantWithSchemaDefault<T>;
}

export const playersReplicant = hasDefault<Schemas.Players>('players');
export const scoreboardReplicant = hasDefault<Schemas.Scoreboard>('scoreboard');
export const attachedBracketReplicant = hasDefault<Schemas.AttachedBracket>('attachedBracket');
export const commentaryReplicant = hasDefault<Schemas.Commentary>('commentary');

export const installedPacksReplicant = hasDefault<Schemas.InstalledPacks>('installedPacks');
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

const defaultBaseUrl = DEFAULT_PACKS_REPO_BASE_URL;
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

export const startggParticipantEntrantMapReplicant = hasDefault<Schemas.StartggParticipantEntrantMap>('startggParticipantEntrantMap');
export const challongeParticipantsMapReplicant = hasDefault<Schemas.ChallongeParticipantsMap>('challongeParticipantsMap');


