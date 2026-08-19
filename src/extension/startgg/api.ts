import type { StartGGGraphQLResponse } from './types.js';

import { setTimeout } from 'node:timers/promises';
import { RateLimiter } from '../util/rate-limiter.js';

export const STARTGG_ENDPOINT = 'https://api.start.gg/gql/alpha';
export const RECENT_TOURNAMENTS_LIMIT = 12;
export const PARTICIPANTS_PAGE_SIZE = 120;

const rateLimiter = new RateLimiter(75, 60_000);

export const requestStartGG = async <T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  retries = 3
): Promise<T> => {
  await rateLimiter.acquire();

  const response = await fetch(STARTGG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    if (response.status === 429 && retries > 0) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0;
      const backoffMs = retryAfterMs > 0 ? retryAfterMs : Math.pow(2, 4 - retries) * 1000 + Math.floor(Math.random() * 200);
      await setTimeout(backoffMs);
      return requestStartGG(query, variables, token, retries - 1);
    }
    if (response.status === 401) {
      throw new Error('Invalid or expired start.gg API token');
    }
    throw new Error(`start.gg responded with ${response.status} ${response.statusText}`.trim());
  }

  let payload: StartGGGraphQLResponse<T>;
  try {
    payload = (await response.json()) as StartGGGraphQLResponse<T>;
  } catch {
    throw new Error('Invalid JSON response from start.gg');
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? 'Unknown start.gg error');
  }

  if (!payload.data) {
    throw new Error('No data returned by start.gg');
  }

  return payload.data;
};

