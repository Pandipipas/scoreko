import {
  requestStartGG,
  RECENT_TOURNAMENTS_LIMIT,
  PARTICIPANTS_PAGE_SIZE,
} from './api.js';
import { globalRequestCache, SimpleLRUCache } from '../util/request-cache.js';
import { startggParticipantEntrantMapReplicant } from '../util/replicants.js';
import type { ImportedPlayer, BracketSet } from '../util/types.js';
import type {
  StartGGRecentTournamentsResponse,
  StartGGTournamentParticipantsResponse,
  StartGGTournamentEventsResponse,
  StartGGEventPhasesResponse,
  StartGGPhaseGroupsResponse,
  StartGGPhaseGroupSetsResponse,
  StartGGReportSetResponse,
  StartGGParticipantNode,
  StartGGSetNode,
} from './types.js';
import { transformParticipantNode, transformSetNode } from './transformers.js';
import {
  RECENT_TOURNAMENTS_QUERY,
  TOURNAMENT_PARTICIPANTS_QUERY,
  TOURNAMENT_EVENTS_QUERY,
  EVENT_PHASES_QUERY,
  PHASE_GROUPS_QUERY,
  GROUP_SETS_QUERY,
  GET_SET_FOR_REPORT_QUERY,
  REPORT_SET_MUTATION,
} from './queries.js';

const MAX_CACHE_SIZE = 1000;
const participantToEntrantCache = new SimpleLRUCache<string, string>(MAX_CACHE_SIZE);

export function cacheParticipantEntrant(participantId: string, entrantId: string) {
  participantToEntrantCache.set(participantId, entrantId);
  if (startggParticipantEntrantMapReplicant.value) {
    startggParticipantEntrantMapReplicant.value[participantId] = entrantId;
  }
}

export function getParticipantEntrant(participantId: string): string | null {
  const cached = participantToEntrantCache.get(participantId);
  if (cached) return cached;
  const repVal = startggParticipantEntrantMapReplicant.value?.[participantId];
  if (repVal) {
    participantToEntrantCache.set(participantId, repVal);
    return repVal;
  }
  return null;
}

export async function fetchRecentTournaments(token: string) {
  return globalRequestCache.wrap('startgg:tournaments', 5 * 60 * 1000, async () => {
    const data = await requestStartGG<StartGGRecentTournamentsResponse>(RECENT_TOURNAMENTS_QUERY, { perPage: RECENT_TOURNAMENTS_LIMIT }, token);

    return data.currentUser?.tournaments.nodes
      .filter((item) => item.slug)
      .sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0))
      .map(({ id, name, slug, startAt, endAt }) => ({ id, name, slug, startAt, endAt })) ?? [];
  });
}

export async function fetchTournamentPlayers(slug: string, token: string) {
  const playersMap = new Map<string, ImportedPlayer>();

  const firstPageData = await requestStartGG<StartGGTournamentParticipantsResponse>(TOURNAMENT_PARTICIPANTS_QUERY, { slug, page: 1, perPage: PARTICIPANTS_PAGE_SIZE }, token);

  if (!firstPageData.tournament) throw new Error('Tournament not found');

  const apiTotalPages = Number(firstPageData.tournament.participants.pageInfo.totalPages);
  const totalPages = Number.isFinite(apiTotalPages) ? Math.max(apiTotalPages, 1) : 1;

  const processNodes = (nodes: StartGGParticipantNode[]) => {
    for (const participant of nodes) {
      const p = transformParticipantNode(participant);
      if (p) playersMap.set(p.id, p);
    }
  };

  processNodes(firstPageData.tournament.participants.nodes);

  if (totalPages > 1) {
    const pagePromises: Array<Promise<StartGGTournamentParticipantsResponse>> = [];

    for (let p = 2; p <= totalPages; p++) {
      pagePromises.push(
        requestStartGG(TOURNAMENT_PARTICIPANTS_QUERY, { slug, page: p, perPage: PARTICIPANTS_PAGE_SIZE }, token)
      );
    }

    const pagesResults = await Promise.all(pagePromises);
    for (const pageData of pagesResults) {
      if (pageData?.tournament) {
        processNodes(pageData.tournament.participants.nodes);
      }
    }
  }

  return Array.from(playersMap.values());
}

export async function fetchEvents(slug: string, token: string) {
  return globalRequestCache.wrap(`startgg:events:${slug}`, 30 * 60 * 1000, async () => {
    const data = await requestStartGG<StartGGTournamentEventsResponse>(TOURNAMENT_EVENTS_QUERY, { slug }, token);
    return data.tournament?.events.map(e => ({ id: String(e.id), name: e.name })) ?? [];
  });
}

export async function fetchPhases(eventId: string, token: string) {
  return globalRequestCache.wrap(`startgg:phases:${eventId}`, 30 * 60 * 1000, async () => {
    const data = await requestStartGG<StartGGEventPhasesResponse>(EVENT_PHASES_QUERY, { eventId }, token);
    return data.event?.phases.map(p => ({ id: String(p.id), name: p.name })) ?? [];
  });
}

export async function fetchGroups(phaseId: string, token: string) {
  return globalRequestCache.wrap(`startgg:groups:${phaseId}`, 30 * 60 * 1000, async () => {
    const data = await requestStartGG<StartGGPhaseGroupsResponse>(PHASE_GROUPS_QUERY, { phaseId }, token);
    return data.phase?.phaseGroups.nodes.map(g => ({ id: String(g.id), name: `Pool ${g.displayIdentifier}` })) ?? [];
  });
}

export async function fetchSets(phaseGroupId: string, token: string) {
  return globalRequestCache.wrap(`startgg:sets:${phaseGroupId}`, 30 * 1000, async () => {
    const setsAcc: BracketSet[] = [];

    const firstPageData = await requestStartGG<StartGGPhaseGroupSetsResponse>(GROUP_SETS_QUERY, { phaseGroupId, page: 1 }, token);

    if (!firstPageData.phaseGroup) {
      return [];
    }

    const totalPages = firstPageData.phaseGroup.sets.pageInfo.totalPages;

    const processSetsNodes = (nodes: StartGGSetNode[]) => {
      return nodes.map(s => transformSetNode(s));
    };

    setsAcc.push(...processSetsNodes(firstPageData.phaseGroup.sets.nodes));

    if (totalPages > 1) {
      const pagePromises: Array<Promise<StartGGPhaseGroupSetsResponse>> = [];

      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(
          requestStartGG(GROUP_SETS_QUERY, { phaseGroupId, page: p }, token)
        );
      }

      const pagesResults = await Promise.all(pagePromises);
      for (const pageData of pagesResults) {
        if (pageData?.phaseGroup) {
          setsAcc.push(...processSetsNodes(pageData.phaseGroup.sets.nodes));
        }
      }
    }

    return setsAcc;
  });
}

export async function reportSet(setId: string, winnerParticipantId: string, scoresCsv: string, token: string) {
  let winnerEntrantId = getParticipantEntrant(winnerParticipantId);
  let p1EntrantId: string | null = null;
  let p2EntrantId: string | null = null;

  if (!winnerEntrantId || (scoresCsv && scoresCsv !== '0-0')) {
    const fetchSetQuery = GET_SET_FOR_REPORT_QUERY;
    const setData = await requestStartGG<StartGGReportSetResponse>(fetchSetQuery, { setId }, token);

    const slots = setData.set?.slots ?? [];

    if (slots[0]?.entrant) {
      p1EntrantId = String(slots[0].entrant.id);
      for (const p of slots[0].entrant.participants) {
        cacheParticipantEntrant(String(p.id), p1EntrantId);
      }
      if (slots[0].entrant.participants.some(p => String(p.id) === winnerParticipantId)) {
        winnerEntrantId = p1EntrantId;
      }
    }
    if (slots[1]?.entrant) {
      p2EntrantId = String(slots[1].entrant.id);
      for (const p of slots[1].entrant.participants) {
        cacheParticipantEntrant(String(p.id), p2EntrantId);
      }
      if (slots[1].entrant.participants.some(p => String(p.id) === winnerParticipantId)) {
        winnerEntrantId = p2EntrantId;
      }
    }
  }


  if (!winnerEntrantId) {
    throw new Error('Could not resolve winner entrant ID');
  }

  const gameData: Array<{ winnerId: string | number; gameNum: number }> = [];
  if (scoresCsv && scoresCsv !== '0-0') {
    const scores = scoresCsv.split('-');
    if (scores.length === 2 && p1EntrantId && p2EntrantId) {
      const p1Score = parseInt(scores[0], 10);
      const p2Score = parseInt(scores[1], 10);
      
      let gameNum = 1;
      if (!isNaN(p1Score)) {
        for (let i = 0; i < p1Score; i++) {
          gameData.push({ winnerId: p1EntrantId, gameNum: gameNum++ });
        }
      }
      if (!isNaN(p2Score)) {
        for (let i = 0; i < p2Score; i++) {
          gameData.push({ winnerId: p2EntrantId, gameNum: gameNum++ });
        }
      }
    }
  }

  const mutation = REPORT_SET_MUTATION;

  const variables: Record<string, unknown> = { setId, winnerId: winnerEntrantId };
  if (gameData.length > 0) {
    variables.gameData = gameData;
  }
  
  await requestStartGG(mutation, variables, token);

  globalRequestCache.invalidate('startgg:sets:');
  return { success: true };
}
