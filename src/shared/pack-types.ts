
export interface PackCharacter {
  name: string;
  slug: string;
  dlc?: boolean;
  sizeBytes: number;
  sha256?: string;
  thumbSha256?: string;
}

export interface PackRegistryEntry {
  id: string;
  name: string;
  gameVersion: string;
  totalSizeBytes: number;
  logoPath: string;
  characterCount: number;
  palette: { start: string; end: string };
}

export interface PackManifest {
  id: string;
  name: string;
  gameVersion: string;
  palette: { start: string; end: string };
  defaultPair?: { left: string; right: string };
  characters: PackCharacter[];
}

export interface PackRegistry {
  schemaVersion: number;
  updatedAt: string;
  packs: PackRegistryEntry[];
}

export interface PackDownloadState {
  status: 'idle' | 'fetching-manifest' | 'downloading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export interface GameSelectOption {
  label: string;
  value: string;
  available: boolean;
  registryEntry: PackRegistryEntry;
  updateInfo?: { installedVersion: string; latestVersion: string };
}