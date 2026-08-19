import { createHandler } from '../util/message-handler.js';
import { nodecg } from '../util/nodecg.js';
import type { OAuthConfig } from '../util/oauth-server.js';
import { oauthServer, getOAuthMode } from './oauth.js';
import { tokenStore } from '../util/token-store.js';
import { getStringProp, sendAck } from '../util/helpers.js';
import {
  fetchRecentTournaments,
  fetchTournamentPlayers,
  fetchEvents,
  fetchPhases,
  fetchGroups,
  fetchSets,
  reportSet,
} from './service.js';

export function setupHandlers() {
  nodecg.listenFor('startgg:createOAuthSession', createHandler({
    handler: async (_payload: unknown, ack) => {
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
    }
  }));

  nodecg.listenFor('startgg:getOAuthSessionStatus', createHandler({
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
        tokenStore.setToken('startgg', status.token);
        status.token = undefined;
      }

      sendAck(ack, null, status);
    }
  }));

  nodecg.listenFor('startgg:fetchRecentTournaments', createHandler({
    requiresToken: 'startgg',
    handler: async (payload: unknown, ack, { token }) => {
      if (!token) {
        sendAck(ack, 'Missing start.gg API token');
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

  nodecg.listenFor('startgg:fetchTournamentPlayers', createHandler({
    requiresToken: 'startgg',
    handler: async (payload: unknown, ack, { token }) => {
      const slug = getStringProp(payload, 'slug');
      if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

      try {
        const players = await fetchTournamentPlayers(slug, token);
        sendAck(ack, null, players);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Unknown error while importing players');
      }
    }
  }));

  nodecg.listenFor('startgg:setManualToken', createHandler({
    handler: (payload: unknown, ack) => {
      const token = getStringProp(payload, 'token');
      if (!token) {
        sendAck(ack, 'Token cannot be empty');
        return;
      }
      tokenStore.setToken('startgg', token);
      sendAck(ack, null);
    }
  }));

  nodecg.listenFor('startgg:fetchEvents', createHandler({
    requiresToken: 'startgg',
    handler: async (payload: unknown, ack, { token }) => {
      const slug = getStringProp(payload, 'slug');
      if (!slug) { sendAck(ack, 'Missing tournament slug'); return; }

      try {
        const events = await fetchEvents(slug, token);
        sendAck(ack, null, events);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Error fetching events');
      }
    }
  }));

  nodecg.listenFor('startgg:fetchPhases', createHandler({
    requiresToken: 'startgg',
    handler: async (payload: unknown, ack, { token }) => {
      const eventId = getStringProp(payload, 'eventId');
      if (!eventId) { sendAck(ack, 'Missing event ID'); return; }

      try {
        const phases = await fetchPhases(eventId, token);
        sendAck(ack, null, phases);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Error fetching phases');
      }
    }
  }));

  nodecg.listenFor('startgg:fetchGroups', createHandler({
    requiresToken: 'startgg',
    handler: async (payload: unknown, ack, { token }) => {
      const phaseId = getStringProp(payload, 'phaseId');
      if (!phaseId) { sendAck(ack, 'Missing phase ID'); return; }

      try {
        const groups = await fetchGroups(phaseId, token);
        sendAck(ack, null, groups);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Error fetching groups');
      }
    }
  }));

  nodecg.listenFor('startgg:fetchSets', createHandler({
    requiresToken: 'startgg',
    handler: async (payload: unknown, ack, { token }) => {
      const phaseGroupId = getStringProp(payload, 'phaseGroupId');
      if (!phaseGroupId) { sendAck(ack, 'Missing phase group ID'); return; }

      try {
        const sets = await fetchSets(phaseGroupId, token);
        sendAck(ack, null, sets);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Error fetching sets');
      }
    }
  }));

  nodecg.listenFor('startgg:reportSet', createHandler({
    requiresToken: 'startgg',
    handler: async (payload: unknown, ack, { token }) => {
      const setId = getStringProp(payload, 'setId');
      const winnerParticipantId = getStringProp(payload, 'winnerId');
      const scoresCsv = getStringProp(payload, 'scoresCsv');
      
      if (!setId) { sendAck(ack, 'Missing set ID'); return; }
      if (!winnerParticipantId) { sendAck(ack, 'Missing winner ID'); return; }

      try {
        const result = await reportSet(setId, winnerParticipantId, scoresCsv, token);
        sendAck(ack, null, result);
      } catch (error) {
        sendAck(ack, error instanceof Error ? error.message : 'Error reporting set');
      }
    }
  }));
}
