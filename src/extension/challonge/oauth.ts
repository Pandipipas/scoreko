import { nodecg } from '../util/nodecg.js';
import { createOAuthServer } from '../util/oauth-server.js';
import type { OAuthMode, OAuthTokenResponse } from './types.js';

const CHALLONGE_OAUTH_AUTHORIZE_ENDPOINT = 'https://challonge.com/oauth/authorize';
const CHALLONGE_OAUTH_TOKEN_ENDPOINT = 'https://api.challonge.com/oauth/token';
const CHALLONGE_OAUTH_SCOPES = [
  'me',
  'tournaments:read',
  'tournaments:write',
  'matches:read',
  'matches:write',
  'participants:read',
  'participants:write',
].join(' ');
const CHALLONGE_OAUTH_CALLBACK_PATH = '/challonge/callback';
const CHALLONGE_OAUTH_SESSION_TTL_MS = 10 * 60 * 1000;

const OAUTH_PROXY_BASE_URL = 'https://scoreko-oauth-proxy.panver.workers.dev';

export const getOAuthMode = (): OAuthMode => {
  const bundleConfig = nodecg.bundleConfig as Record<string, unknown>;
  const clientId = String(bundleConfig.challongeClientId ?? '').trim();
  const clientSecret = String(bundleConfig.challongeClientSecret ?? '').trim();

  if (clientId && clientSecret) {
    return { type: 'dev', clientId, clientSecret };
  }

  return { type: 'proxy', proxyBaseUrl: OAUTH_PROXY_BASE_URL };
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

  const response = await fetch(CHALLONGE_OAUTH_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const rawBody = await response.text();
  let payload: OAuthTokenResponse;
  try {
    payload = JSON.parse(rawBody) as OAuthTokenResponse;
  } catch {
    payload = { message: rawBody };
  }

  if (!response.ok) {
    throw new Error(
      payload.error_description ??
      payload.error ??
      payload.message ??
      `OAuth token request failed (${response.status})`,
    );
  }

  const token = String(payload.access_token ?? '').trim();
  if (!token) {
    throw new Error(
      payload.error_description ??
      payload.error ??
      payload.message ??
      'OAuth token response did not include an access token',
    );
  }

  return token;
};

const exchangeCodeViaProxy = async (
  code: string,
  redirectUri: string,
  proxyBaseUrl: string,
): Promise<string> => {
  const response = await fetch(`${proxyBaseUrl}/oauth/challonge/token`, {
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
  provider: 'Challonge',
  callbackPath: CHALLONGE_OAUTH_CALLBACK_PATH,
  authorizeEndpoint: CHALLONGE_OAUTH_AUTHORIZE_ENDPOINT,
  scope: CHALLONGE_OAUTH_SCOPES,
  sessionTtlMs: CHALLONGE_OAUTH_SESSION_TTL_MS,
  exchangeToken: exchangeOAuthCodeForToken,
});

{
  const mode = getOAuthMode();
  if (mode.type === 'dev') {
    
    
    nodecg.log.info('[challonge] Mounted challonge extension (dev)');
  } else {
    
    fetch(`${mode.proxyBaseUrl}/oauth/challonge/client-id`)
      .then((res) => {
        if (res.ok) nodecg.log.info('[challonge] Mounted challonge extension (proxy)');
        else nodecg.log.warn(`[challonge] Failed to connect challonge extension (proxy: ${res.status})`);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        nodecg.log.warn(`[challonge] Failed to connect challonge extension (proxy: ${message})`);
      });
  }
}