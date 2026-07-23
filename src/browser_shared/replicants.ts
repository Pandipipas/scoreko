import { useReplicant } from 'nodecg-vue-composable';
import type { Schemas } from '../types';
import type { PackDownloadState, PackRegistry } from '../shared/pack-types';
import type { PacksConfig } from '../shared/pack-config';

const thisBundle = 'scoreko';

export const playersReplicant = useReplicant<Schemas.Players>('players', thisBundle);
export const scoreboardReplicant = useReplicant<Schemas.Scoreboard>('scoreboard', thisBundle);
export const graphicsSettingsReplicant = useReplicant<Schemas.GraphicsSettings>('graphicsSettings', thisBundle);

export const commentaryReplicant = useReplicant<Schemas.Commentary>('commentary', thisBundle);

export const installedPacksReplicant = useReplicant<string[]>('installedPacks', thisBundle, { defaultValue: [] });
export const packRegistryReplicant = useReplicant<PackRegistry | null>('packRegistry', thisBundle, { defaultValue: null });
export const downloadStatesReplicant = useReplicant<Record<string, PackDownloadState>>('downloadStates', thisBundle, { defaultValue: {} });
export const availableUpdatesReplicant = useReplicant<Record<string, { installedVersion: string; latestVersion: string }>>('availableUpdates', thisBundle, { defaultValue: {} });
export const packsConfigReplicant = useReplicant<PacksConfig>('packsConfig', thisBundle);

export const attachedBracketReplicant = useReplicant<Schemas.AttachedBracket | null>('attachedBracket', thisBundle, { defaultValue: null });
export const integrationAuthStateReplicant = useReplicant<Record<string, boolean>>('integrationAuthState', thisBundle, { defaultValue: {} });

