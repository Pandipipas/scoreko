import { randomUUID } from 'node:crypto';
import { nodecg } from './nodecg.js';

export interface OAuthConfig {
  clientId: string;
  
  clientSecret?: string;
}

export interface OAuthSessionStatus {
  status: 'pending' | 'completed' | 'error' | 'expired';
  token?: string;
  error?: string;
}

export interface CreateSessionResult {
  sessionId: string;
  authUrl: string;
}

export interface OAuthServerOptions {
  
  provider: string;
  
  callbackPath: string;
  
  authorizeEndpoint: string;
  
  scope: string;
  
  sessionTtlMs: number;
  
  exchangeToken: (code: string, redirectUri: string, config: OAuthConfig) => Promise<string>;
}

export interface OAuthServerHandle {
  
  ensureServer(config: OAuthConfig): Promise<void>;
  
  createSession(config: OAuthConfig): CreateSessionResult;
  
  getSessionStatus(sessionId: string): OAuthSessionStatus | null;
}

interface OAuthSession {
  sessionId: string;
  state: string;
  expiresAt: number;
  status: 'pending' | 'completed' | 'error' | 'expired';
  token?: string;
  error?: string;
}

const escapeHtml = (s: string) => {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
};

const renderCallbackHtml = (title: string, message: string) => {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; background: #121212; color: #fff; }
      .box { max-width: 680px; padding: 1rem 1.2rem; border: 1px solid #444; border-radius: 8px; }
      .ok { color: #66bb6a; }
      .ko { color: #ef5350; }
    </style>
  </head>
  <body>
    <div class="box">
      <h2>${safeTitle}</h2>
      <p>${safeMessage}</p>
      <p>You can close this tab and return to Scoreko.</p>
    </div>
  </body>
</html>`;
};

import type { Response } from 'express';

const respondWithCallbackHtml = (
  res: Response,
  statusCode: number,
  title: string,
  message: string,
) => {
  res.status(statusCode);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderCallbackHtml(title, message));
};

export const createOAuthServer = (options: OAuthServerOptions): OAuthServerHandle => {
  const sessions = new Map<string, OAuthSession>();
  let serverStarted = false;

  const getCallbackUrl = () => {
    
    const cfg = nodecg.config;
    if (cfg.baseURL) {
      let base = cfg.baseURL.endsWith('/') ? cfg.baseURL.slice(0, -1) : cfg.baseURL;
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = `http://${base}`;
      }
      
      
      
      try {
        const urlObj = new URL(base);
        if (urlObj.hostname === '127.0.0.1') {
          urlObj.hostname = 'localhost';
          base = urlObj.origin;
        }
      } catch {
        // ignore
      }

      return `${base}${options.callbackPath}`;
    }
    return `http://localhost:${cfg.port || 9090}${options.callbackPath}`;
  };

  const updateSession = (sessionId: string, update: Partial<OAuthSession>) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    sessions.set(sessionId, { ...session, ...update });
  };

  const cleanupSessions = () => {
    const now = Date.now();
    sessions.forEach((session, sessionId) => {
      if (session.expiresAt > now) return;

      if (session.status === 'pending') {
        updateSession(sessionId, { status: 'expired' });
      }

      if (session.status !== 'pending') {
        sessions.delete(sessionId);
      }
    });
  };

  const ensureServer = async (_config: OAuthConfig): Promise<void> => {
    if (serverStarted) return;
    
    const router = nodecg.Router();
    const callbackUrl = getCallbackUrl();

    router.get('/', (req, res) => {
      cleanupSessions();

      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const error = typeof req.query.error === 'string' ? req.query.error : '';

      const session = Array.from(sessions.values()).find((s) => s.state === state);

      if (!session) {
        respondWithCallbackHtml(
          res, 400,
          'Invalid OAuth',
          'No active session was found for this authorization.',
        );
        return;
      }

      if (session.expiresAt <= Date.now()) {
        updateSession(session.sessionId, { status: 'expired' });
        respondWithCallbackHtml(
          res, 400,
          'Session expired',
          'The OAuth session expired. Start the process again from Scoreko.',
        );
        return;
      }

      if (error) {
        updateSession(session.sessionId, { status: 'error', error });
        respondWithCallbackHtml(
          res, 400,
          'OAuth canceled',
          `${options.provider} returned this error: ${error}`,
        );
        return;
      }

      if (!code) {
        updateSession(session.sessionId, { status: 'error', error: 'Missing authorization code' });
        respondWithCallbackHtml(
          res, 400,
          'Incomplete OAuth',
          'No authorization code was received.',
        );
        return;
      }

      void options
        .exchangeToken(code, callbackUrl, _config)
        .then((token) => {
          updateSession(session.sessionId, { status: 'completed', token, error: undefined });
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Failed to exchange authorization code';
          updateSession(session.sessionId, { status: 'error', error: message });
        });

      respondWithCallbackHtml(
        res, 200,
        'Authorization received',
        'Your authorization was received. Finishing sign-in in the background...',
      );
    });

    nodecg.mount(options.callbackPath, router);
    serverStarted = true;
  };

  const createSession = (config: OAuthConfig): CreateSessionResult => {
    cleanupSessions();

    const sessionId = randomUUID();
    const state = randomUUID();

    sessions.set(sessionId, {
      sessionId,
      state,
      expiresAt: Date.now() + options.sessionTtlMs,
      status: 'pending',
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: getCallbackUrl(),
      scope: options.scope,
      state,
    });

    return {
      sessionId,
      authUrl: `${options.authorizeEndpoint}?${params.toString()}`,
    };
  };

  const getSessionStatus = (sessionId: string): OAuthSessionStatus | null => {
    cleanupSessions();
    const session = sessions.get(sessionId);
    if (!session) return null;

    const token = session.status === 'completed' ? session.token : undefined;
    if (token) {
      session.token = undefined;
    }

    return {
      status: session.status,
      token,
      error: session.status === 'error' ? session.error : undefined,
    };
  };

  return { ensureServer, createSession, getSessionStatus };
};