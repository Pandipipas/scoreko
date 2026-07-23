import type { ChallongeErrorPayload, ImportedPlayer, RecentTournament } from './types.js';
import { resolveCountryCode } from '../util/helpers.js';
import { RateLimiter } from '../util/rate-limiter.js';

export const CHALLONGE_API_BASE = 'https://api.challonge.com/v2.1';
export const RECENT_TOURNAMENTS_LIMIT = 20;

const rateLimiter = new RateLimiter(60, 60_000);

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const rawBody = await response.text();
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
};

export const requestChallonge = async (path: string, token: string, method: string = 'GET', body?: unknown | { v1: unknown; v2: unknown }): Promise<unknown> => {
  await rateLimiter.acquire();
  const requestUrl = `${CHALLONGE_API_BASE}${path}`;
  
  
  const isApiKey = !token.includes('.');

  const executeV1 = async () => {
    const v1Body = body && typeof body === 'object' && 'v1' in body ? (body as Record<string, unknown>).v1 : body;
    const v1RequestUrl = `https://api.challonge.com/v1${path}`;
    
    const v1Response = await fetch(v1RequestUrl, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
      },
      body: v1Body ? JSON.stringify(v1Body) : undefined,
    });
    const v1Payload = await parseJsonResponse(v1Response);

    if (v1Response.ok) {
      return v1Payload;
    }

    const v1Error = v1Payload as ChallongeErrorPayload;
    throw new Error(
      v1Error?.errors?.detail ??
      v1Error?.error ??
      `Challonge responded with ${v1Response.status} ${v1Response.statusText}`.trim(),
    );
  };

  if (isApiKey) {
    return executeV1();
  }

  const v2Body = body && typeof body === 'object' && 'v2' in body ? (body as Record<string, unknown>).v2 : body;
  const v2Response = await fetch(requestUrl, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization-Type': 'v2',
      Authorization: `Bearer ${token}`,
    },
    body: v2Body ? JSON.stringify(v2Body) : undefined,
  });
  const v2Payload = await parseJsonResponse(v2Response);

  if (v2Response.ok) {
    return v2Payload;
  }

  if (v2Response.status === 401) {
    return executeV1();
  }

  const v2Error = v2Payload as ChallongeErrorPayload;
  throw new Error(
    v2Error?.errors?.detail ??
    v2Error?.error ??
    `Challonge responded with ${v2Response.status} ${v2Response.statusText}`.trim(),
  );
};

export const normalizeTournamentSlug = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^tournaments\//i, '')
    .replace(/^\/+/, '');
};


const getNumberProp = (payload: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const raw = payload[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

export const parseRecentTournaments = (payload: unknown): RecentTournament[] => {
  const rows: RecentTournament[] = [];

  const push = (candidate: Record<string, unknown>) => {
    const attributes =
      typeof candidate.attributes === 'object' && candidate.attributes !== null
        ? (candidate.attributes as Record<string, unknown>)
        : candidate;

    const id = String(candidate.id ?? attributes.id ?? attributes.tournament_id ?? '').trim();
    const name = String(attributes.name ?? attributes.full_name ?? '').trim();
    const slug = normalizeTournamentSlug(
      String(attributes.url ?? attributes.slug ?? attributes.identifier ?? id),
    );

    if (!id || !name || !slug) return;

    rows.push({
      id,
      name,
      slug,
      startAt: getNumberProp(attributes, ['start_at', 'started_at', 'startAt']),
      endAt: getNumberProp(attributes, ['completed_at', 'end_at', 'ended_at', 'endAt']),
    });
  };

  if (Array.isArray(payload)) {
    for (const row of payload as unknown[]) {
      const wrapper = row as Record<string, unknown>;
      const tournament =
        typeof wrapper.tournament === 'object' && wrapper.tournament !== null
          ? (wrapper.tournament as Record<string, unknown>)
          : wrapper;
      push(tournament);
    }
    return rows;
  }

  if (typeof payload === 'object' && payload !== null) {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      for (const row of data as unknown[]) {
        if (typeof row === 'object' && row !== null) {
          push(row as Record<string, unknown>);
        }
      }
    }
  }

  return rows;
};

export const parseImportedPlayers = (payload: unknown): ImportedPlayer[] => {
  const map = new Map<string, ImportedPlayer>();

  const push = (candidate: Record<string, unknown>) => {
    const attributes =
      typeof candidate.attributes === 'object' && candidate.attributes !== null
        ? (candidate.attributes as Record<string, unknown>)
        : candidate;

    const id = String(
      candidate.id ?? attributes.id ?? attributes.participant_id ?? '',
    ).trim();

    const rawDisplayName = String(
      attributes.display_name ??
      attributes.name ??
      attributes.username ??
      attributes.gamer_tag ??
      '',
    ).trim();

    if (!id || !rawDisplayName) return;

    const PIPE_PATTERN = /^(.+?)\s*\|\s*(.+)$/;
    const pipeMatch = PIPE_PATTERN.exec(rawDisplayName);

    const teamFromName = pipeMatch ? pipeMatch[1].trim() : '';
    const gamertag = pipeMatch ? pipeMatch[2].trim() : rawDisplayName;
    const team = String(attributes.team_name ?? '').trim() || teamFromName;

    map.set(id, {
      id,
      gamertag,
      name: '',
      team,
      country: resolveCountryCode(attributes.country as string | null | undefined),
      twitter: String(attributes.twitter_handle ?? attributes.twitter ?? '').trim(),
    });
  };

  if (Array.isArray(payload)) {
    for (const row of payload as unknown[]) {
      const wrapper = row as Record<string, unknown>;
      const participant =
        typeof wrapper.participant === 'object' && wrapper.participant !== null
          ? (wrapper.participant as Record<string, unknown>)
          : wrapper;
      push(participant);
    }
    return Array.from(map.values());
  }

  if (typeof payload === 'object' && payload !== null) {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      for (const row of data as unknown[]) {
        if (typeof row === 'object' && row !== null) {
          push(row as Record<string, unknown>);
        }
      }
    }
  }

  return Array.from(map.values());
};

import type { BracketSet } from '../util/types.js';

export const parseMatches = (payload: unknown): BracketSet[] => {
  const rows: BracketSet[] = [];
  const push = (candidate: Record<string, unknown>) => {
    const attributes =
      typeof candidate.attributes === 'object' && candidate.attributes !== null
        ? (candidate.attributes as Record<string, unknown>)
        : candidate;
    
    let state: BracketSet['state'] = 'pending';
    if (attributes.state === 'open') state = 'in_progress';
    if (attributes.state === 'complete') state = 'completed';

    let player1Id = '';
    let player2Id = '';
    let p1Score: string | number | null = null;
    let p2Score: string | number | null = null;
    const winnerId = attributes.winner_id ? String(attributes.winner_id) : undefined;

    if (Array.isArray(attributes.points_by_participant) && attributes.points_by_participant.length >= 2) {
      const pbp = attributes.points_by_participant as Record<string, unknown>[];
      player1Id = pbp[0]?.participant_id ? String(pbp[0].participant_id) : '';
      player2Id = pbp[1]?.participant_id ? String(pbp[1].participant_id) : '';
      
      const getScore = (pts: unknown) => {
        if (Array.isArray(pts) && pts.length > 0) return pts[0];
        if (typeof pts === 'string' || typeof pts === 'number') return pts;
        return null;
      };
      
      p1Score = getScore(pbp[0]?.scores) as string | number | null;
      p2Score = getScore(pbp[1]?.scores) as string | number | null;
    } else {
      const extractPlayerId = (key: string, attrKey: string): string => {
        if (attributes[attrKey]) return String(attributes[attrKey]);
        const rels = candidate.relationships as Record<string, unknown>;
        if (rels && typeof rels === 'object' && rels !== null) {
          const playerObj = rels[key] as Record<string, unknown>;
          if (playerObj && typeof playerObj === 'object' && playerObj !== null) {
            const dataObj = playerObj.data as Record<string, unknown>;
            if (dataObj && typeof dataObj === 'object' && dataObj !== null && dataObj.id) {
              return String(dataObj.id);
            }
          }
        }
        return '';
      };
      player1Id = extractPlayerId('player1', 'player1_id');
      player2Id = extractPlayerId('player2', 'player2_id');
      
      
      if (attributes.scores_csv && typeof attributes.scores_csv === 'string') {
        const matchObj = attributes.scores_csv.match(/(-?\d+)-(-?\d+)/);
        if (matchObj) {
          p1Score = parseInt(matchObj[1], 10);
          p2Score = parseInt(matchObj[2], 10);
        }
      }
    }

    const roundNum = Number(attributes.round) || 0;

    rows.push({
      id: String(candidate.id ?? attributes.id),
      fullRoundText: '', 
      round: roundNum,
      state,
      winnerId,
      player1: player1Id ? { id: player1Id, gamertag: 'Unknown', score: p1Score } : null,
      player2: player2Id ? { id: player2Id, gamertag: 'Unknown', score: p2Score } : null,
    });
  };
  if (Array.isArray(payload)) {
    for (const row of payload as unknown[]) {
      const wrapper = row as Record<string, unknown>;
      const match = typeof wrapper.match === 'object' && wrapper.match !== null ? wrapper.match : wrapper;
      push(match as Record<string, unknown>);
    }
  } else if (typeof payload === 'object' && payload !== null) {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      for (const row of data as unknown[]) {
        push(row as Record<string, unknown>);
      }
    }
  }

  
  const isDoubleElim = rows.some(r => r.round < 0);
  const minLoserRound = isDoubleElim ? Math.min(...rows.map(r => r.round).filter(r => r < 0)) : 0;
  
  const wRounds = [...new Set(rows.map(r => r.round).filter(r => r > 0))].sort((a, b) => b - a);
  const singleMatchRounds = wRounds.filter(r => rows.filter(x => x.round === r).length === 1);
  
  let wfRound = -1;
  let gfRound = -1;
  let gfResetRound = -1;
  
  if (isDoubleElim) {
    if (singleMatchRounds.length >= 3) {
      gfResetRound = singleMatchRounds[0];
      gfRound = singleMatchRounds[1];
      wfRound = singleMatchRounds[2];
    } else if (singleMatchRounds.length === 2) {
      gfRound = singleMatchRounds[0];
      wfRound = singleMatchRounds[1];
    } else if (singleMatchRounds.length === 1) {
      wfRound = singleMatchRounds[0];
      const wfIndex = wRounds.indexOf(wfRound);
      if (wfIndex > 0) {
        gfRound = wRounds[wfIndex - 1];
      }
    } else if (singleMatchRounds.length === 0 && wRounds.length > 0) {
      gfRound = wRounds[0];
      wfRound = wRounds.length > 1 ? wRounds[1] : -1;
    }
  } else {
    if (singleMatchRounds.length >= 1) {
      gfRound = singleMatchRounds[0];
    }
  }

  for (const match of rows) {
    if (match.round > 0) {
      if (match.round === gfResetRound) {
        match.fullRoundText = 'Grand Final Reset';
      } else if (match.round === gfRound) {
        match.fullRoundText = 'Grand Final';
      } else if (match.round === wfRound) {
        match.fullRoundText = 'Winners Final';
      } else {
        const wfIndex = wRounds.indexOf(wfRound !== -1 ? wfRound : gfRound);
        if (wfIndex !== -1 && match.round === wRounds[wfIndex + 1]) {
          match.fullRoundText = isDoubleElim ? 'Winners Semi-Finals' : 'Semi-Finals';
        } else if (wfIndex !== -1 && match.round === wRounds[wfIndex + 2]) {
          match.fullRoundText = isDoubleElim ? 'Winners Quarter-Finals' : 'Quarter-Finals';
        } else {
          match.fullRoundText = isDoubleElim ? `Winners Round ${match.round}` : `Round ${match.round}`;
        }
      }
    } else if (match.round < 0) {
      if (match.round === minLoserRound) match.fullRoundText = 'Losers Final';
      else if (match.round === minLoserRound + 1) match.fullRoundText = 'Losers Semi-Finals';
      else if (match.round === minLoserRound + 2) match.fullRoundText = 'Losers Quarter-Finals';
      else match.fullRoundText = `Losers Round ${Math.abs(match.round)}`;
    }
  }

  return rows;
};
