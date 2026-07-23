import { nodecg } from '../util/nodecg.js';
import { createOAuthServer } from '../util/oauth-server.js';
import type { OAuthMode, OAuthTokenResponse } from './types.js';

const STARTGG_OAUTH_AUTHORIZE_ENDPOINT = 'https://www.start.gg/api/-/rest/oauth/authorize';
const STARTGG_OAUTH_TOKEN_ENDPOINTS = [
  'https://www.start.gg/api/-/rest/oauth/access_token',
  'https://api.start.gg/oauth/access_token',
];
const STARTGG_OAUTH_SCOPES = 'user.identity tournament.manager tournament.reporter';
const STARTGG_OAUTH_CALLBACK_PATH = '/startgg/callback';
const STARTGG_OAUTH_SESSION_TTL_MS = 10 * 60 * 1000;

const OAUTH_PROXY_BASE_URL = 'https://scoreko-oauth-proxy.panver.workers.dev';

export const getOAuthMode = (): OAuthMode => {
  const bundleConfig = nodecg.bundleConfig as Record<string, unknown>;
  const clientId = String(bundleConfig.startggClientId ?? '').trim();
  const clientSecret = String(bundleConfig.startggClientSecret ?? '').trim();

  if (clientId && clientSecret) {
    return { type: 'dev', clientId, clientSecret };
  }

  return { type: 'proxy', proxyBaseUrl: OAUTH_PROXY_BASE_URL };
};

const parseOAuthTokenPayload = async (response: Response): Promise<OAuthTokenResponse> => {
  const rawBody = await response.text();
  try {
    return JSON.parse(rawBody) as OAuthTokenResponse;
  } catch {
    return { message: rawBody };
  }
};

const exchangeCodeDirectly = async (
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<string> => {
  const params = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri,
  });

  let lastError = 'Unknown OAuth token exchange error';

  for (const tokenEndpoint of STARTGG_OAUTH_TOKEN_ENDPOINTS) {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const payload = await parseOAuthTokenPayload(response);

    if (response.ok) {
      const token = String(payload.access_token ?? '').trim();
      if (token) return token;
      lastError =
        payload.error_description ??
        payload.error ??
        payload.message ??
        'OAuth token response did not include an access token';
      continue;
    }

    lastError =
      payload.error_description ??
      payload.error ??
      payload.message ??
      `OAuth token request failed (${response.status})`;

    if (response.status !== 404) break;
  }

  throw new Error(lastError);
};

const exchangeCodeViaProxy = async (
  code: string,
  redirectUri: string,
  proxyBaseUrl: string,
): Promise<string> => {
  const response = await fetch(`${proxyBaseUrl}/oauth/startgg/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  const rawBody = await response.text();
  let payload: { access_token?: string; error?: string };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    payload = { error: rawBody };
  }

  if (!response.ok) {
    throw new Error(payload.error ?? `Proxy responded with ${response.status}`);
  }
  const token = String(payload.access_token ?? '').trim();
  if (!token) throw new Error(payload.error ?? 'Proxy did not return a token');
  return token;
};

const exchangeOAuthCodeForToken = async (
  code: string,
  redirectUri: string,
): Promise<string> => {
  const mode = getOAuthMode();
  if (mode.type === 'dev') {
    return exchangeCodeDirectly(code, redirectUri, mode.clientId, mode.clientSecret);
  }
  return exchangeCodeViaProxy(code, redirectUri, mode.proxyBaseUrl);
};

export const oauthServer = createOAuthServer({
  provider: 'start.gg',
  callbackPath: STARTGG_OAUTH_CALLBACK_PATH,
  authorizeEndpoint: STARTGG_OAUTH_AUTHORIZE_ENDPOINT,
  scope: STARTGG_OAUTH_SCOPES,
  sessionTtlMs: STARTGG_OAUTH_SESSION_TTL_MS,
  exchangeToken: exchangeOAuthCodeForToken,
});

{
  const mode = getOAuthMode();
  if (mode.type === 'dev') {
    
    
    nodecg.log.info('[start.gg] Mounted start.gg extension (dev)');
  } else {
    
    fetch(`${mode.proxyBaseUrl}/oauth/startgg/client-id`)
      .then((res) => {
        if (res.ok) nodecg.log.info('[start.gg] Mounted start.gg extension (proxy)');
        else nodecg.log.warn(`[start.gg] Failed to connect start.gg extension (proxy: ${res.status})`);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        nodecg.log.warn(`[start.gg] Failed to connect start.gg extension (proxy: ${message})`);
      });
  }
}