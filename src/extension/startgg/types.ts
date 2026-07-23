
export interface StartGGGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export type {
  RecentTournament,
  ImportedPlayer,
  OAuthTokenResponse,
  OAuthMode,
} from '../util/types.js';
