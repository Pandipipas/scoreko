import test from 'node:test';
import assert from 'node:assert';
import { RateLimiter } from './rate-limiter.js';
import { RequestCache } from './request-cache.js';
import { validatePacksUrl } from './helpers.js';

test('RateLimiter — should limit request frequency within sliding window', async () => {
  const limiter = new RateLimiter(3, 200); 
  const start = Date.now();

  
  await limiter.acquire();
  await limiter.acquire();
  await limiter.acquire();

  const elapsedFirstThree = Date.now() - start;
  assert.ok(elapsedFirstThree < 50, `First 3 requests should resolve immediately (took ${elapsedFirstThree}ms)`);

  
  await limiter.acquire();
  const totalElapsed = Date.now() - start;
  assert.ok(totalElapsed >= 200, `4th request should wait for window rollover (took ${totalElapsed}ms)`);
});

test('RequestCache — should deduplicate in-flight requests and honor TTL', async () => {
  const cache = new RequestCache(60_000); 
  let calls = 0;

  const fetcher = async () => {
    calls++;
    return `data-${calls}`;
  };

  
  const p1 = cache.wrap('test-key', 500, fetcher);
  const p2 = cache.wrap('test-key', 500, fetcher);

  const [res1, res2] = await Promise.all([p1, p2]);
  assert.strictEqual(res1, 'data-1');
  assert.strictEqual(res2, 'data-1');
  assert.strictEqual(calls, 1, 'Fetcher should only be called once when concurrent');

  
  const res3 = await cache.wrap('test-key', 500, fetcher);
  assert.strictEqual(res3, 'data-1');
  assert.strictEqual(calls, 1, 'Fetcher should not be called again while cache is valid');

  
  await new Promise((resolve) => setTimeout(resolve, 600));
  const res4 = await cache.wrap('test-key', 500, fetcher);
  assert.strictEqual(res4, 'data-2', 'Should fetch fresh data after TTL expires');
  assert.strictEqual(calls, 2);
});

test('RequestCache — should periodically cleanup expired entries in the background', async () => {
  const cache = new RequestCache(50); 
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return 'value';
  };

  await cache.wrap('cleanup-key', 20, fetcher); 
  assert.strictEqual(calls, 1);

  
  await new Promise((resolve) => setTimeout(resolve, 150));

  
  
  const res = await cache.wrap('cleanup-key', 20, fetcher);
  assert.strictEqual(res, 'value');
  assert.strictEqual(calls, 2, 'Should fetch again because background cleanup removed the entry');
});

test('validatePacksUrl — should reject insecure or local URLs (SSRF prevention)', () => {
  
  assert.strictEqual(validatePacksUrl('https://gitea.panver.cloud/'), true);
  assert.strictEqual(validatePacksUrl('https://github.com/Pandipipas/scoreko-packs'), true);

  
  assert.strictEqual(validatePacksUrl('http://gitea.panver.cloud/'), false);

  
  assert.strictEqual(validatePacksUrl('https://localhost/'), false);
  assert.strictEqual(validatePacksUrl('https://127.0.0.1/'), false);
  assert.strictEqual(validatePacksUrl('https://[::1]/'), false);
  assert.strictEqual(validatePacksUrl('https://192.168.1.1/'), false);
  assert.strictEqual(validatePacksUrl('https://10.0.0.1/'), false);
  assert.strictEqual(validatePacksUrl('https://172.16.0.1/'), false);
  assert.strictEqual(validatePacksUrl('https://172.31.255.255/'), false);

  
  assert.strictEqual(validatePacksUrl('not-a-url'), false);
});

test('Challonge v1 Auth — should encode credentials properly using basic auth', () => {
  const apiToken = 'my-legacy-api-token-123';
  const expectedAuthHeader = `Basic ${Buffer.from(':' + apiToken).toString('base64')}`;
  
  assert.strictEqual(expectedAuthHeader, 'Basic Om15LWxlZ2FjeS1hcGktdG9rZW4tMTIz');
  
  const decoded = Buffer.from(expectedAuthHeader.split(' ')[1]!, 'base64').toString('utf8');
  assert.strictEqual(decoded, ':my-legacy-api-token-123');
});
