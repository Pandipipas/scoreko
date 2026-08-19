import {
  requestChallonge,
  parseRecentTournaments,
  parseImportedPlayers,
  parseMatches,
  RECENT_TOURNAMENTS_LIMIT,
} from './api.js';
import { nodecg } from '../util/nodecg.js';
import { globalRequestCache } from '../util/request-cache.js';
import { challongeParticipantsMapReplicant } from '../util/replicants.js';
import type { ImportedPlayer } from '../util/types.js';

export async function fetchRecentTournaments(token: string) {
  return globalRequestCache.wrap('challonge:tournaments', 5 * 60 * 1000, async () => {
    const raw = await requestChallonge('/tournaments.json', token);
    return parseRecentTournaments(raw)
      .sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0))
      .slice(0, RECENT_TOURNAMENTS_LIMIT);
  });
}

export async function fetchTournamentPlayers(slug: string, token: string) {
  return globalRequestCache.wrap(`challonge:players:${slug}`, 10 * 60 * 1000, async () => {
    try {
      const raw = await requestChallonge(
        `/tournaments/${encodeURIComponent(slug)}/participants.json`,
        token,
      );
      const players = parseImportedPlayers(raw);
      if (challongeParticipantsMapReplicant.value) {
        for (const p of players) {
          challongeParticipantsMapReplicant.value[p.id] = p as unknown as Record<string, unknown>;
        }
      }
      return players;
    } catch (err) {
      const rep = challongeParticipantsMapReplicant.value ?? {};
      const fallbackPlayers = Object.values(rep) as unknown as ImportedPlayer[];
      if (fallbackPlayers.length > 0) return fallbackPlayers;
      throw err;
    }
  });
}

export async function fetchMatches(slug: string, token: string) {
  return globalRequestCache.wrap(`challonge:matches:${slug}`, 30 * 1000, async () => {
    const [matchesRes, participantsRes] = await Promise.allSettled([
      requestChallonge(`/tournaments/${encodeURIComponent(slug)}/matches.json`, token),
      requestChallonge(`/tournaments/${encodeURIComponent(slug)}/participants.json`, token),
    ]);

    if (matchesRes.status === 'rejected') {
      throw matchesRes.reason;
    }
    const rawMatches = matchesRes.value;

    let rawParticipants: unknown;
    if (participantsRes.status === 'fulfilled') {
      rawParticipants = participantsRes.value;
    } else {
      const msg = participantsRes.reason instanceof Error ? participantsRes.reason.message : String(participantsRes.reason);
      nodecg.log.warn(`[challonge] Failed to fetch participants for "${slug}": ${msg}. Using cached data.`);
    }

    const players = rawParticipants ? parseImportedPlayers(rawParticipants) : [];
    if (challongeParticipantsMapReplicant.value && players.length > 0) {
      for (const p of players) {
        challongeParticipantsMapReplicant.value[p.id] = p as unknown as Record<string, unknown>;
      }
    }
    
    const playersMap = new Map<string, { gamertag: string }>();
    if (challongeParticipantsMapReplicant.value) {
      for (const [id, pData] of Object.entries(challongeParticipantsMapReplicant.value)) {
        if (pData && typeof pData.gamertag === 'string') {
          playersMap.set(id, { gamertag: pData.gamertag });
        }
      }
    }
    for (const p of players) {
      playersMap.set(p.id, p);
    }
    
    const parsedMatches = parseMatches(rawMatches);
    for (const match of parsedMatches) {
      if (match.player1 && playersMap.has(match.player1.id)) {
        match.player1.gamertag = playersMap.get(match.player1.id)!.gamertag;
      }
      if (match.player2 && playersMap.has(match.player2.id)) {
        match.player2.gamertag = playersMap.get(match.player2.id)!.gamertag;
      }
    }
    return parsedMatches;
  });
}

export async function reportMatch(slug: string, matchId: string, winnerId: string, scoresCsv: string, token: string) {
  const v1Match: Record<string, string> = { winner_id: winnerId };
  if (scoresCsv) v1Match.scores_csv = scoresCsv;

  const v2Match: Record<string, string | boolean> = { participant_id: winnerId, advancing: true };
  if (scoresCsv) v2Match.score_set = scoresCsv;

  const body = {
    v1: {
      match: v1Match,
    },
    v2: {
      data: {
        type: "Match",
        attributes: {
          match: [v2Match]
        }
      }
    }
  };
  
  await requestChallonge(
    `/tournaments/${encodeURIComponent(slug)}/matches/${encodeURIComponent(matchId)}.json`,
    token,
    'PUT',
    body,
  );
  
  globalRequestCache.invalidateExact(`challonge:matches:${slug}`);
  return { success: true };
}
