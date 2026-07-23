import { nodecg } from '../util/nodecg.js';
import type { OAuthConfig } from '../util/oauth-server.js';
import { oauthServer, getOAuthMode } from './oauth.js';
import { tokenStore } from '../util/token-store.js';
import {
  requestChallonge,
  normalizeTournamentSlug,
  parseRecentTournaments,
  parseImportedPlayers,
  parseMatches,
  RECENT_TOURNAMENTS_LIMIT,
} from './api.js';
import { getStringProp, sendAck } from '../util/helpers.js';
import { globalRequestCache } from '../util/request-cache.js';

nodecg.listenFor('challonge:createOAuthSession', async (_payload: unknown, ack) => {
  const mode = getOAuthMode();
  let serverConfig: OAuthConfig;

  if (mode.type === 'dev') {
    serverConfig = {
      clientId: mode.clientId,
    };
  } else {
    
    try {
      const res = await fetch(`${mode.proxyBaseUrl}/oauth/challonge/client-id`);
      if (!res.ok) throw new Error(`Proxy responded with ${res.status}`);
      const data = await res.json() as { clientId?: string };
      const clientId = String(data.clientId ?? '').trim();
      if (!clientId) throw new Error('Proxy did not return a clientId');
      serverConfig = { clientId };
    } catch (err) {
      sendAck(
        ack,
        err instanceof Error ? err.message : 'Could not fetch OAuth config from proxy',
      );
      return;
    }
  }

  try {
    await oauthServer.ensureServer(serverConfig);
  } catch (err) {
    sendAck(ack, err instanceof Error ? err.message : 'Could not start the OAuth callback server');
    return;
  }

  sendAck(ack, null, oauthServer.createSession(serverConfig));
});

nodecg.listenFor('challonge:getOAuthSessionStatus', (payload: unknown, ack) => {
  try {
    const sessionId = getStringProp(payload, 'sessionId');
    if (!sessionId) {
      sendAck(ack, 'Missing OAuth session id');
      return;
    }

    const status = oauthServer.getSessionStatus(sessionId);
    if (!status) {
      sendAck(ack, 'OAuth session not found');
      return;
    }

    if (status.status === 'completed' && status.token) {
      tokenStore.setToken('challonge', status.token);
      status.token = undefined;
    }

    sendAck(ack, null, status);
  } catch (err) {
    sendAck(ack, err instanceof Error ? err.message : 'Unexpected error in getOAuthSessionStatus');
  }
});

nodecg.listenFor('challonge:fetchRecentTournaments', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('challonge');
  if (!token) {
    sendAck(ack, 'Missing Challonge API token');
    return;
  }

  try {
    const tournaments = await globalRequestCache.wrap('challonge:tournaments', 5 * 60 * 1000, async () => {
      const raw = await requestChallonge('/tournaments.json', token);
      return parseRecentTournaments(raw)
        .sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0))
        .slice(0, RECENT_TOURNAMENTS_LIMIT);
    });
    sendAck(ack, null, tournaments);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Unknown error while loading tournaments');
  }
});

nodecg.listenFor('challonge:fetchTournamentPlayers', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('challonge');
  const slug = normalizeTournamentSlug(getStringProp(payload, 'slug'));

  if (!token) { sendAck(ack, 'Missing Challonge API token'); return; }
  if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

  try {
    const players = await globalRequestCache.wrap(`challonge:players:${slug}`, 10 * 60 * 1000, async () => {
      const raw = await requestChallonge(
        `/tournaments/${encodeURIComponent(slug)}/participants.json`,
        token,
      );
      return parseImportedPlayers(raw);
    });
    sendAck(ack, null, players);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Unknown error while importing players');
  }
});

nodecg.listenFor('challonge:setManualToken', (payload: unknown, ack) => {
  try {
    const token = getStringProp(payload, 'token');
    tokenStore.setToken('challonge', token);
    if (ack && !ack.handled) ack(null);
  } catch (err) {
    sendAck(ack, err instanceof Error ? err.message : 'Unexpected error in setManualToken');
  }
});

nodecg.listenFor('challonge:fetchMatches', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('challonge');
  const slug = normalizeTournamentSlug(getStringProp(payload, 'slug'));

  if (!token) { sendAck(ack, 'Missing Challonge API token'); return; }
  if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

  try {
    const matches = await globalRequestCache.wrap(`challonge:matches:${slug}`, 30 * 1000, async () => {
      const [rawMatches, rawParticipants] = await Promise.all([
        requestChallonge(`/tournaments/${encodeURIComponent(slug)}/matches.json`, token),
        requestChallonge(`/tournaments/${encodeURIComponent(slug)}/participants.json`, token)
      ]);
      
      const players = parseImportedPlayers(rawParticipants);
      const playersMap = new Map(players.map(p => [p.id, p]));
      
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
    
    sendAck(ack, null, matches);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Unknown error while fetching matches');
  }
});

nodecg.listenFor('challonge:reportMatch', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('challonge');
  const slug = normalizeTournamentSlug(getStringProp(payload, 'slug'));
  const matchId = String((payload as Record<string, unknown>).matchId ?? '').trim();
  const winnerId = String((payload as Record<string, unknown>).winnerId ?? '').trim();
  const scoresCsv = String((payload as Record<string, unknown>).scoresCsv ?? '').trim();

  if (!token) { sendAck(ack, 'Missing Challonge API token'); return; }
  if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }
  if (!matchId) { sendAck(ack, 'Missing match ID'); return; }
  if (!winnerId) { sendAck(ack, 'Missing winner ID'); return; }

  try {
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
    
    sendAck(ack, null, { success: true });
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Unknown error while reporting match');
  }
});
