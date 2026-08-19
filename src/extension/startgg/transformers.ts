import type { ImportedPlayer, BracketSet, BracketPlayer } from '../util/types.js';
import type { StartGGParticipantNode, StartGGSetNode } from './types.js';
import { resolveCountryCode } from '../util/helpers.js';
import { cacheParticipantEntrant } from './service.js';

export function transformParticipantNode(participant: StartGGParticipantNode): ImportedPlayer | null {
  const playerId = String(participant.id);
  const gamertag = (participant.gamerTag ?? '').trim();
  if (!gamertag) return null;

  let twitter = '';
  let twitch = '';
  if (participant.user?.authorizations) {
    const tw = participant.user.authorizations.find(a => a.type?.toUpperCase() === 'TWITTER');
    if (tw?.externalUsername) twitter = tw.externalUsername;
    const tch = participant.user.authorizations.find(a => a.type?.toUpperCase() === 'TWITCH');
    if (tch?.externalUsername) twitch = tch.externalUsername;
  }

  let avatarUrl = '';
  if (participant.user?.images?.length) {
    const img = participant.user.images.find(i => i.type === 'profile') ?? participant.user.images[0];
    if (img?.url) avatarUrl = img.url;
  }

  return {
    id: playerId,
    gamertag,
    name: gamertag,
    team: (participant.prefix ?? '').trim(),
    country: resolveCountryCode(participant.user?.location?.country),
    twitter,
    twitch,
    avatarUrl,
    startggId: playerId,
  };
}

export function transformSetNode(s: StartGGSetNode): BracketSet {
  const p1Participant = s.slots[0]?.entrant?.participants[0];
  const p2Participant = s.slots[1]?.entrant?.participants[0];
  
  // Cache the participant IDs to entrant IDs for reporting
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
}
