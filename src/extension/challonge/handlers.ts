import { createHandler } from '../util/message-handler.js';
import { nodecg } from '../util/nodecg.js';
import type { OAuthConfig } from '../util/oauth-server.js';
import { oauthServer, getOAuthMode } from './oauth.js';
import { tokenStore } from '../util/token-store.js';
import { normalizeTournamentSlug } from './api.js';
import { getStringProp, sendAck } from '../util/helpers.js';
import {
  fetchRecentTournaments,
  fetchTournamentPlayers,
  fetchMatches,
  reportMatch,
} from './service.js';

export function setupHandlers() {
  nodecg.listenFor('challonge:createOAuthSession', createHandler({
    handler: async (_payload: unknown, ack) => {
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
    }
  }));

  nodecg.listenFor('challonge:getOAuthSessionStatus', createHandler({
    handler: (payload: unknown, ack) => {
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
    }
  }));

  nodecg.listenFor('challonge:fetchRecentTournaments', createHandler({
    requiresToken: 'challonge',
    handler: async (payload: unknown, ack, { token }) => {
      if (!token) {
        sendAck(ack, 'Missing Challonge API token');
        return;
      }

      try {
        const tournaments = await fetchRecentTournaments(token);
        sendAck(ack, null, tournaments);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Unknown error while loading tournaments');
      }
    }
  }));

  nodecg.listenFor('challonge:fetchTournamentPlayers', createHandler({
    requiresToken: 'challonge',
    handler: async (payload: unknown, ack, { token }) => {
      const slug = normalizeTournamentSlug(getStringProp(payload, 'slug'));
      if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

      try {
        const players = await fetchTournamentPlayers(slug, token);
        sendAck(ack, null, players);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Unknown error while importing players');
      }
    }
  }));

  nodecg.listenFor('challonge:setManualToken', createHandler({
    handler: (payload: unknown, ack) => {
      const token = getStringProp(payload, 'token');
      if (!token) {
        sendAck(ack, 'Token cannot be empty');
        return;
      }
      tokenStore.setToken('challonge', token);
      sendAck(ack, null);
    }
  }));

  nodecg.listenFor('challonge:fetchMatches', createHandler({
    requiresToken: 'challonge',
    handler: async (payload: unknown, ack, { token }) => {
      const slug = normalizeTournamentSlug(getStringProp(payload, 'slug'));
      if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

      try {
        const matches = await fetchMatches(slug, token);
        sendAck(ack, null, matches);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Unknown error while fetching matches');
      }
    }
  }));

  nodecg.listenFor('challonge:reportMatch', createHandler({
    requiresToken: 'challonge',
    handler: async (payload: unknown, ack, { token }) => {
      const slug = normalizeTournamentSlug(getStringProp(payload, 'slug'));
      const matchId = String((payload as Record<string, unknown>).matchId ?? '').trim();
      const winnerId = String((payload as Record<string, unknown>).winnerId ?? '').trim();
      const scoresCsv = String((payload as Record<string, unknown>).scoresCsv ?? '').trim();

      if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }
      if (!matchId) { sendAck(ack, 'Missing match ID'); return; }
      if (!winnerId) { sendAck(ack, 'Missing winner ID'); return; }

      try {
        const result = await reportMatch(slug, matchId, winnerId, scoresCsv, token);
        sendAck(ack, null, result);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Unknown error while reporting match');
      }
    }
  }));
}
