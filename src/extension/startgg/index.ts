import { nodecg } from '../util/nodecg.js';
import type { OAuthConfig } from '../util/oauth-server.js';
import { oauthServer, getOAuthMode } from './oauth.js';
import { tokenStore } from '../util/token-store.js';
import {
  requestStartGG,
  RECENT_TOURNAMENTS_LIMIT,
  PARTICIPANTS_PAGE_SIZE,
} from './api.js';
import { getStringProp, sendAck, resolveCountryCode } from '../util/helpers.js';
import { globalRequestCache } from '../util/request-cache.js';
import type { RecentTournament, ImportedPlayer, BracketSet, BracketPlayer } from '../util/types.js';

const participantToEntrantCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

function cacheParticipantEntrant(participantId: string, entrantId: string) {
  if (participantToEntrantCache.size >= MAX_CACHE_SIZE) {
    const firstKey = participantToEntrantCache.keys().next().value;
    if (firstKey !== undefined) {
      participantToEntrantCache.delete(firstKey);
    }
  }
  participantToEntrantCache.set(participantId, entrantId);
}

nodecg.listenFor('startgg:createOAuthSession', async (_payload: unknown, ack) => {
  const mode = getOAuthMode();
  let serverConfig: OAuthConfig;

  if (mode.type === 'dev') {
    serverConfig = {
      clientId: mode.clientId,
    };
  } else {
    try {
      const res = await fetch(`${mode.proxyBaseUrl}/oauth/startgg/client-id`);
      if (!res.ok) throw new Error(`Proxy responded with ${res.status}`);
      const data = await res.json() as { clientId?: string };
      const clientId = String(data.clientId ?? '').trim();
      if (!clientId) throw new Error('Proxy did not return a clientId');
      serverConfig = { clientId };
    } catch (err) {
      sendAck(ack, err instanceof Error ? err.message : 'Could not fetch OAuth config from proxy');
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

nodecg.listenFor('startgg:getOAuthSessionStatus', (payload: unknown, ack) => {
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
      tokenStore.setToken('startgg', status.token);
      status.token = undefined;
    }

    sendAck(ack, null, status);
  } catch (err) {
    sendAck(ack, err instanceof Error ? err.message : 'Unexpected error in getOAuthSessionStatus');
  }
});

nodecg.listenFor('startgg:fetchRecentTournaments', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('startgg');
  if (!token) {
    sendAck(ack, 'Missing start.gg API token');
    return;
  }

  const query = `
    query RecentTournaments($perPage: Int!) {
      currentUser {
        tournaments(query: { perPage: $perPage, filter: { tournamentView: "admin" } }) {
          nodes {
            id
            name
            slug
            startAt
            endAt
          }
        }
      }
    }
  `;

  try {
    const tournaments = await globalRequestCache.wrap('startgg:tournaments', 5 * 60 * 1000, async () => {
      const data = await requestStartGG<{
        currentUser: { tournaments: { nodes: RecentTournament[] } } | null;
      }>(query, { perPage: RECENT_TOURNAMENTS_LIMIT }, token);

      return data.currentUser?.tournaments.nodes
        .filter((item) => item.slug)
        .sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0))
        .map(({ id, name, slug, startAt, endAt }) => ({ id, name, slug, startAt, endAt })) ?? [];
    });

    sendAck(ack, null, tournaments);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Unknown error while loading tournaments');
  }
});

nodecg.listenFor('startgg:fetchTournamentPlayers', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('startgg');
  const slug = getStringProp(payload, 'slug');

  if (!token) { sendAck(ack, 'Missing start.gg API token'); return; }
  if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

  const query = `
    query TournamentParticipants($slug: String!, $page: Int!, $perPage: Int!) {
      tournament(slug: $slug) {
        participants(query: { page: $page, perPage: $perPage }) {
          pageInfo {
            totalPages
          }
          nodes {
            id
            gamerTag
            prefix
            user {
              location {
                country
              }
            }
          }
        }
      }
    }
  `;

  try {
    const playersMap = new Map<string, ImportedPlayer>();

    
    const firstPageData = await requestStartGG<{
      tournament: {
        participants: {
          pageInfo: { totalPages: number };
          nodes: Array<{
            id: number;
            gamerTag: string | null;
            prefix: string | null;
            user: { location: { country: string | null } | null } | null;
          }>;
        };
      } | null;
    }>(query, { slug, page: 1, perPage: PARTICIPANTS_PAGE_SIZE }, token);

    if (!firstPageData.tournament) throw new Error('Tournament not found');

    const apiTotalPages = Number(firstPageData.tournament.participants.pageInfo.totalPages);
    const totalPages = Number.isFinite(apiTotalPages) ? Math.max(apiTotalPages, 1) : 1;

    const processNodes = (nodes: Array<{
      id: number;
      gamerTag: string | null;
      prefix: string | null;
      user: { location: { country: string | null } | null } | null;
    }>) => {
      for (const participant of nodes) {
        const playerId = String(participant.id);
        const gamertag = (participant.gamerTag ?? '').trim();
        if (!gamertag) continue;

        playersMap.set(playerId, {
          id: playerId,
          gamertag,
          name: gamertag,
          team: (participant.prefix ?? '').trim(),
          country: resolveCountryCode(participant.user?.location?.country),
          twitter: '',
        });
      }
    };

    processNodes(firstPageData.tournament.participants.nodes);

    if (totalPages > 1) {
      const pagePromises: Array<Promise<{
        tournament: {
          participants: {
            nodes: Array<{
              id: number;
              gamerTag: string | null;
              prefix: string | null;
              user: { location: { country: string | null } | null } | null;
            }>;
          };
        } | null;
      }>> = [];

      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(
          requestStartGG(query, { slug, page: p, perPage: PARTICIPANTS_PAGE_SIZE }, token)
        );
      }

      const pagesResults = await Promise.all(pagePromises);
      for (const pageData of pagesResults) {
        if (pageData?.tournament) {
          processNodes(pageData.tournament.participants.nodes);
        }
      }
    }

    sendAck(ack, null, Array.from(playersMap.values()));
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Unknown error while importing players');
  }
});

nodecg.listenFor('startgg:setManualToken', (payload: unknown, ack) => {
  try {
    const token = getStringProp(payload, 'token');
    tokenStore.setToken('startgg', token);
    if (ack && !ack.handled) ack(null);
  } catch (err) {
    sendAck(ack, err instanceof Error ? err.message : 'Unexpected error in setManualToken');
  }
});

nodecg.listenFor('startgg:fetchEvents', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('startgg');
  const slug = getStringProp(payload, 'slug');
  if (!token) { sendAck(ack, 'Missing start.gg API token'); return; }
  if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

  const query = `
    query TournamentEvents($slug: String!) {
      tournament(slug: $slug) {
        events {
          id
          name
        }
      }
    }
  `;
  try {
    const events = await globalRequestCache.wrap(`startgg:events:${slug}`, 30 * 60 * 1000, async () => {
      const data = await requestStartGG<{ tournament: { events: Array<{ id: string | number; name: string }> } | null }>(query, { slug }, token);
      return data.tournament?.events.map(e => ({ id: String(e.id), name: e.name })) ?? [];
    });
    sendAck(ack, null, events);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Error fetching events');
  }
});

nodecg.listenFor('startgg:fetchPhases', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('startgg');
  const eventId = getStringProp(payload, 'eventId');
  if (!token) { sendAck(ack, 'Missing start.gg API token'); return; }
  if (!eventId) { sendAck(ack, 'Missing event ID'); return; }

  const query = `
    query EventPhases($eventId: ID!) {
      event(id: $eventId) {
        phases {
          id
          name
        }
      }
    }
  `;
  try {
    const phases = await globalRequestCache.wrap(`startgg:phases:${eventId}`, 30 * 60 * 1000, async () => {
      const data = await requestStartGG<{ event: { phases: Array<{ id: string | number; name: string }> } | null }>(query, { eventId }, token);
      return data.event?.phases.map(p => ({ id: String(p.id), name: p.name })) ?? [];
    });
    sendAck(ack, null, phases);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Error fetching phases');
  }
});

nodecg.listenFor('startgg:fetchGroups', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('startgg');
  const phaseId = getStringProp(payload, 'phaseId');
  if (!token) { sendAck(ack, 'Missing start.gg API token'); return; }
  if (!phaseId) { sendAck(ack, 'Missing phase ID'); return; }

  const query = `
    query PhaseGroups($phaseId: ID!) {
      phase(id: $phaseId) {
        phaseGroups {
          nodes {
            id
            displayIdentifier
          }
        }
      }
    }
  `;
  try {
    const groups = await globalRequestCache.wrap(`startgg:groups:${phaseId}`, 30 * 60 * 1000, async () => {
      const data = await requestStartGG<{ phase: { phaseGroups: { nodes: Array<{ id: string | number; displayIdentifier: string }> } } | null }>(query, { phaseId }, token);
      return data.phase?.phaseGroups.nodes.map(g => ({ id: String(g.id), name: `Pool ${g.displayIdentifier}` })) ?? [];
    });
    sendAck(ack, null, groups);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Error fetching groups');
  }
});

nodecg.listenFor('startgg:fetchSets', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('startgg');
  const phaseGroupId = getStringProp(payload, 'phaseGroupId');
  if (!token) { sendAck(ack, 'Missing start.gg API token'); return; }
  if (!phaseGroupId) { sendAck(ack, 'Missing phase group ID'); return; }

  const query = `
    query GroupSets($phaseGroupId: ID!, $page: Int!) {
      phaseGroup(id: $phaseGroupId) {
        sets(page: $page, perPage: 50) {
          pageInfo {
            totalPages
          }
          nodes {
            id
            winnerId
            fullRoundText
            round
            state
            slots {
              entrant {
                id
                participants {
                  id
                  gamerTag
                  prefix
                }
              }
              standing {
                stats {
                  score {
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const allSets = await globalRequestCache.wrap(`startgg:sets:${phaseGroupId}`, 30 * 1000, async () => {
      const setsAcc: BracketSet[] = [];

      
      const firstPageData = await requestStartGG<{
        phaseGroup: {
          sets: {
            pageInfo: { totalPages: number };
            nodes: Array<{
              id: string | number;
              winnerId: string | number | null;
              fullRoundText: string;
              round: number;
              state: number;
              slots: Array<{
                entrant: {
                  id: string | number;
                  participants: Array<{
                    id: string | number;
                    gamerTag: string;
                    prefix: string | null;
                  }>;
                } | null;
                standing: {
                  stats: { score: { value: number } | null } | null;
                } | null;
              }>;
            }>;
          };
        } | null;
      }>(query, { phaseGroupId, page: 1 }, token);

      if (!firstPageData.phaseGroup) {
        return [];
      }

      const totalPages = firstPageData.phaseGroup.sets.pageInfo.totalPages;

      const processSetsNodes = (nodes: Array<{
        id: string | number;
        winnerId: string | number | null;
        fullRoundText: string;
        round: number;
        state: number;
        slots: Array<{
          entrant: {
            id: string | number;
            participants: Array<{
              id: string | number;
              gamerTag: string;
              prefix: string | null;
            }>;
          } | null;
          standing: {
            stats: { score: { value: number } | null } | null;
          } | null;
        }>;
      }>) => {
        return nodes.map(s => {
          const p1Participant = s.slots[0]?.entrant?.participants[0];
          const p2Participant = s.slots[1]?.entrant?.participants[0];
          
          
          if (p1Participant && s.slots[0]?.entrant?.id) {
            cacheParticipantEntrant(String(p1Participant.id), String(s.slots[0].entrant.id));
          }
          if (p2Participant && s.slots[1]?.entrant?.id) {
            cacheParticipantEntrant(String(p2Participant.id), String(s.slots[1].entrant.id));
          }

          let state: BracketSet['state'] = 'pending';
          if (s.state === 2 || s.state === 6) state = 'in_progress';
          else if (s.state === 3) state = 'completed';
          else if (s.state === 1 && p1Participant && p2Participant) state = 'in_progress';

          const p1Score = s.slots[0]?.standing?.stats?.score?.value ?? null;
          const p2Score = s.slots[1]?.standing?.stats?.score?.value ?? null;

          const player1: BracketPlayer | null = p1Participant ? {
            id: String(p1Participant.id),
            gamertag: p1Participant.gamerTag,
            team: p1Participant.prefix ?? undefined,
            score: p1Score,
          } : null;

          const player2: BracketPlayer | null = p2Participant ? {
            id: String(p2Participant.id),
            gamertag: p2Participant.gamerTag,
            team: p2Participant.prefix ?? undefined,
            score: p2Score,
          } : null;

          let resolvedWinnerId: string | undefined = undefined;
          if (s.winnerId) {
            if (s.slots[0]?.entrant && String(s.slots[0].entrant.id) === String(s.winnerId) && p1Participant) {
              resolvedWinnerId = String(p1Participant.id);
            } else if (s.slots[1]?.entrant && String(s.slots[1].entrant.id) === String(s.winnerId) && p2Participant) {
              resolvedWinnerId = String(p2Participant.id);
            } else {
              resolvedWinnerId = String(s.winnerId);
            }
          }

          return {
            id: String(s.id),
            fullRoundText: s.fullRoundText,
            round: s.round,
            state,
            player1,
            player2,
            winnerId: resolvedWinnerId,
          };
        });
      };

      setsAcc.push(...processSetsNodes(firstPageData.phaseGroup.sets.nodes));

      if (totalPages > 1) {
        const pagePromises: Array<Promise<{
          phaseGroup: {
            sets: {
              nodes: Array<{
                id: string | number;
                winnerId: string | number | null;
                fullRoundText: string;
                round: number;
                state: number;
                slots: Array<{
                  entrant: {
                    id: string | number;
                    participants: Array<{
                      id: string | number;
                      gamerTag: string;
                      prefix: string | null;
                    }>;
                  } | null;
                  standing: {
                    stats: { score: { value: number } | null } | null;
                  } | null;
                }>;
              }>;
            };
          } | null;
        }>> = [];

        for (let p = 2; p <= totalPages; p++) {
          pagePromises.push(
            requestStartGG(query, { phaseGroupId, page: p }, token)
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

    sendAck(ack, null, allSets);
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Error fetching sets');
  }
});

nodecg.listenFor('startgg:reportSet', async (payload: unknown, ack) => {
  const token = tokenStore.getToken('startgg');
  const setId = getStringProp(payload, 'setId');
  const winnerParticipantId = getStringProp(payload, 'winnerId');
  const scoresCsv = getStringProp(payload, 'scoresCsv');
  
  if (!token) { sendAck(ack, 'Missing start.gg API token'); return; }
  if (!setId) { sendAck(ack, 'Missing set ID'); return; }
  if (!winnerParticipantId) { sendAck(ack, 'Missing winner ID'); return; }

  try {
    let winnerEntrantId = participantToEntrantCache.get(winnerParticipantId) ?? null;
    let p1EntrantId: string | null = null;
    let p2EntrantId: string | null = null;

    
    if (!winnerEntrantId) {
      const fetchSetQuery = `
        query GetSetForReport($setId: ID!) {
          set(id: $setId) {
            slots {
              entrant {
                id
                participants { id }
              }
            }
          }
        }
      `;
      const setData = await requestStartGG<{
        set: {
          slots: Array<{
            entrant: {
              id: string | number;
              participants: Array<{ id: string | number }>;
            } | null;
          }>;
        };
      }>(fetchSetQuery, { setId }, token);

      const slots = setData.set?.slots ?? [];

      if (slots[0]?.entrant) {
        p1EntrantId = String(slots[0].entrant.id);
        if (slots[0].entrant.participants.some(p => String(p.id) === winnerParticipantId)) {
          winnerEntrantId = p1EntrantId;
        }
      }
      if (slots[1]?.entrant) {
        p2EntrantId = String(slots[1].entrant.id);
        if (slots[1].entrant.participants.some(p => String(p.id) === winnerParticipantId)) {
          winnerEntrantId = p2EntrantId;
        }
      }
    } else {
      
      
      
      
      if (scoresCsv && scoresCsv !== '0-0') {
        const fetchSetQuery = `
          query GetSetForReport($setId: ID!) {
            set(id: $setId) {
              slots {
                entrant {
                  id
                  participants { id }
                }
              }
            }
          }
        `;
        const setData = await requestStartGG<{
          set: {
            slots: Array<{
              entrant: {
                id: string | number;
                participants: Array<{ id: string | number }>;
              } | null;
            }>;
          };
        }>(fetchSetQuery, { setId }, token);

        const slots = setData.set?.slots ?? [];
        if (slots[0]?.entrant) p1EntrantId = String(slots[0].entrant.id);
        if (slots[1]?.entrant) p2EntrantId = String(slots[1].entrant.id);
      }
    }

    if (!winnerEntrantId) {
      sendAck(ack, 'Could not resolve winner entrant ID');
      return;
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

    const mutation = `
      mutation ReportSet($setId: ID!, $winnerId: ID, $gameData: [BracketSetGameDataInput]) {
        reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {
          id
          state
        }
      }
    `;

    const variables: Record<string, unknown> = { setId, winnerId: winnerEntrantId };
    if (gameData.length > 0) {
      variables.gameData = gameData;
    }
    
    await requestStartGG(mutation, variables, token);

    
    globalRequestCache.invalidate('startgg:sets:');
    
    sendAck(ack, null, { success: true });
  } catch (error) {
    sendAck(ack, error instanceof Error ? error.message : 'Error reporting set');
  }
});
