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
  
  const isSuccess = title.toLowerCase().includes('received') || title.toLowerCase().includes('success');
  const accentColor = isSuccess ? '#4caf50' : '#E66B3C';
  const iconSvg = isSuccess 
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle} - Scoreko</title>
    <style>
      :root {
        --bg-main: #121212;
        --glass-bg: rgba(30, 30, 30, 0.6);
        --border-subtle: rgba(255, 255, 255, 0.08);
        --text-base: rgba(255, 255, 255, 0.92);
        --text-muted: rgba(255, 255, 255, 0.70);
      }
      body { 
        font-family: 'Inter', system-ui, -apple-system, sans-serif; 
        margin: 0; 
        background: var(--bg-main); 
        color: var(--text-base); 
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
      }
      .glass-panel { 
        width: 100%;
        max-width: 460px; 
        padding: 40px 32px; 
        background: var(--glass-bg);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        text-align: center;
        margin: 20px;
        box-sizing: border-box;
      }
      .icon { margin-bottom: 24px; }
      h2 { 
        margin: 0 0 16px 0; 
        font-size: 24px;
        font-weight: 600;
        color: var(--text-base);
      }
      p { 
        margin: 0 0 32px 0; 
        font-size: 16px;
        line-height: 1.5;
        color: var(--text-muted);
      }
      .action-hint {
        display: inline-block;
        padding: 12px 24px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-base);
      }
    </style>
  </head>
  <body>
    <div class="glass-panel">
      <div class="icon">${iconSvg}</div>
      <h2>${safeTitle}</h2>
      <p>${safeMessage}</p>
      <div class="action-hint">You can safely close this tab and return to Scoreko.</div>
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
  const sessionsByState = new Map<string, OAuthSession>();
  const rateLimitMap = new Map<string, { count: number, timestamp: number }>();
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
        // Ignore URL parsing errors
      }

      return `${base}${options.callbackPath}`;
    }
    return `http://localhost:${cfg.port || 9090}${options.callbackPath}`;
  };

  const updateSession = (sessionId: string, update: Partial<OAuthSession>) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    const newSession = { ...session, ...update } as OAuthSession;
    sessions.set(sessionId, newSession);
    sessionsByState.set(newSession.state, newSession);
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
        sessionsByState.delete(session.state);
      }
    });

    rateLimitMap.forEach((data, ip) => {
      if (now - data.timestamp > 60000) {
        rateLimitMap.delete(ip);
      }
    });
  };

  const ensureServer = async (_config: OAuthConfig): Promise<void> => {
    if (serverStarted) return;
    
    const router = nodecg.Router();
    const callbackUrl = getCallbackUrl();

    router.get('/', (req, res) => {
      cleanupSessions();

      const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
      const now = Date.now();
      const limitData = rateLimitMap.get(ip) || { count: 0, timestamp: now };
      if (now - limitData.timestamp > 60000) {
        limitData.count = 1;
        limitData.timestamp = now;
      } else {
        limitData.count++;
      }
      rateLimitMap.set(ip, limitData);

      if (limitData.count > 10) {
        respondWithCallbackHtml(res, 429, 'Too Many Requests', 'Please try again later.');
        return;
      }

      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const error = typeof req.query.error === 'string' ? req.query.error : '';

      const session = sessionsByState.get(state);

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

    const newSession: OAuthSession = {
      sessionId,
      state,
      expiresAt: Date.now() + options.sessionTtlMs,
      status: 'pending',
    };
    sessions.set(sessionId, newSession);
    sessionsByState.set(state, newSession);

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