import type NodeCG from 'nodecg/types';
import type { Configschema } from './schemas.d.ts';

export type NodeCGServerAPI = NodeCG.default.ServerAPI<Configschema>;
export type * as Schemas from './schemas.d.ts';

export interface RecentTournament {
  id: string | number;
  name: string;
  slug: string;
  startAt: number | null;
  endAt: number | null;
}

export interface ImportedPlayer {
  id: string;
  gamertag: string;
  name: string;
  team: string;
  country: string;
  twitter: string;
}

export interface OAuthTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  message?: string;
}

export type OAuthMode =
  | { type: 'dev'; clientId: string; clientSecret: string }
  | { type: 'proxy'; proxyBaseUrl: string };

export interface BracketEvent {
  id: string;
  name: string;
}

export interface BracketPhase {
  id: string;
  name: string;
}

export interface BracketPhaseGroup {
  id: string;
  name: string;
}

export interface BracketSet {
  id: string;
  fullRoundText: string;
  round: number;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  state: 'pending' | 'in_progress' | 'completed';
  winnerId?: string;
}

export interface BracketPlayer {
  id: string;
  gamertag: string;
  team?: string;
  score?: number | string | null;
}

export interface PackCharacter {
  name: string;
  slug: string;
  dlc?: boolean;
  sizeBytes: number;
  sha256?: string;
  thumbSha256?: string;
}

export interface PackManifest {
  id: string;
  name: string;
  gameVersion: string;
  palette: { start: string; end: string };
  defaultPair?: { left: string; right: string };
  characters: PackCharacter[];
}

