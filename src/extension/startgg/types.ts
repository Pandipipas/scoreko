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

export interface StartGGRecentTournamentsResponse {
  currentUser: { tournaments: { nodes: import('../util/types.js').RecentTournament[] } } | null;
}

export interface StartGGParticipantNode {
  id: number;
  gamerTag: string | null;
  prefix: string | null;
  user: {
    location: { country: string | null } | null;
    authorizations?: Array<{ type: string; externalUsername: string }> | null;
    images?: Array<{ type: string; url: string }> | null;
  } | null;
}

export interface StartGGTournamentParticipantsResponse {
  tournament: {
    participants: {
      pageInfo: { totalPages: number };
      nodes: StartGGParticipantNode[];
    };
  } | null;
}

export interface StartGGEventNode {
  id: string | number;
  name: string;
}

export interface StartGGTournamentEventsResponse {
  tournament: { events: StartGGEventNode[] } | null;
}

export interface StartGGPhaseNode {
  id: string | number;
  name: string;
}

export interface StartGGEventPhasesResponse {
  event: { phases: StartGGPhaseNode[] } | null;
}

export interface StartGGPhaseGroupNode {
  id: string | number;
  displayIdentifier: string;
}

export interface StartGGPhaseGroupsResponse {
  phase: { phaseGroups: { nodes: StartGGPhaseGroupNode[] } } | null;
}

export interface StartGGSetParticipantNode {
  id: string | number;
  gamerTag: string;
  prefix: string | null;
}

export interface StartGGSetEntrantNode {
  id: string | number;
  participants: StartGGSetParticipantNode[];
}

export interface StartGGSetSlotNode {
  entrant: StartGGSetEntrantNode | null;
  standing: {
    stats: { score: { value: number } | null } | null;
  } | null;
}

export interface StartGGSetNode {
  id: string | number;
  winnerId: string | number | null;
  fullRoundText: string;
  round: number;
  state: number;
  slots: StartGGSetSlotNode[];
}

export interface StartGGPhaseGroupSetsResponse {
  phaseGroup: {
    sets: {
      pageInfo: { totalPages: number };
      nodes: StartGGSetNode[];
    };
  } | null;
}

export interface StartGGReportSetSlotNode {
  entrant: {
    id: string | number;
    participants: Array<{ id: string | number }>;
  } | null;
}

export interface StartGGReportSetResponse {
  set: {
    slots: StartGGReportSetSlotNode[];
  } | null;
}
