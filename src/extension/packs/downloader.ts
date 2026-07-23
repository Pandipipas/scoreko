import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { nodecg } from '../util/nodecg.js';
import { getErrorMessage } from '../util/error.js';
import { downloadStatesReplicant, type PackDownloadState } from '../util/replicants.js';

interface HTTPError extends Error {
  status?: number;
}

export const activeDownloads = new Map<string, AbortController>();

export const setDownloadState = (packId: string, patch: Partial<PackDownloadState>): void => {
  const current = downloadStatesReplicant.value?.[packId] ?? { status: 'idle', progress: 0 };
  downloadStatesReplicant.value = {
    ...downloadStatesReplicant.value,
    [packId]: { ...current, ...patch },
  };
};

export const fetchWithRetry = async (
  url: string,
  options?: RequestInit,
  retries = 5,
  delay = 1000,
): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} — ${url}`) as HTTPError;
      error.status = response.status;
      throw error;
    }
    return response;
  } catch (error) {
    if (options?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw error;
    }
    const httpErr = error as HTTPError;
    if (httpErr.status === 404 || retries <= 1) {
      throw error;
    }
    
    const jitter = Math.random() * delay * 0.3;
    const nextDelay = delay * 2 + jitter;

    nodecg.log.warn(
      `[packs] Download failed for ${url}. Retrying in ${Math.round(delay)}ms... (${retries - 1} retries left). Error: ${getErrorMessage(error)}`,
    );
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, delay);
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        
        reject((options.signal?.reason as unknown) ?? new Error('Aborted'));
      });
    });
    
    return fetchWithRetry(url, options, retries - 1, nextDelay);
  }
};

export const fetchBuffer = async (url: string, signal?: AbortSignal, retries = 5, delay = 1000): Promise<Buffer> => {
  const response = await fetchWithRetry(url, { signal }, retries, delay);
  return Buffer.from(await response.arrayBuffer());
};

export const trySaveImage = async (
  destDir: string,
  filename: string,
  extensions: readonly string[],
  buildUrl: (ext: string, suffix?: string) => string,
  signal?: AbortSignal,
  expectedSize?: number,
  expectedSha256?: string,
  expectedThumbSha256?: string,
): Promise<boolean> => {
  for (const ext of extensions) {
    try {
      if (signal?.aborted) {
        
        throw (signal.reason as unknown) ?? new Error('Aborted');
      }
      const buffer = await fetchBuffer(buildUrl(ext), signal);
      
      let thumbBuffer: Buffer | undefined;
      try {
        thumbBuffer = await fetchBuffer(buildUrl(ext, '-thumb'), signal, 2, 1000);
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
          throw err;
        }
      }

      const totalSize = buffer.length + (thumbBuffer?.length ?? 0);

      if (expectedSize && expectedSize > 0 && totalSize !== expectedSize) {
        throw new Error(`Size mismatch (${totalSize} vs ${expectedSize} expected bytes).`);
      }
      
      if (expectedSha256) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        if (hash !== expectedSha256) {
          throw new Error(`SHA-256 hash mismatch for main file.`);
        }
      }

      if (expectedThumbSha256 && thumbBuffer) {
        const thumbHash = crypto.createHash('sha256').update(thumbBuffer).digest('hex');
        if (thumbHash !== expectedThumbSha256) {
          throw new Error(`SHA-256 hash mismatch for thumb file.`);
        }
      }
      
      await fs.writeFile(path.join(destDir, `${filename}.webp`), buffer);
      if (thumbBuffer) {
        await fs.writeFile(path.join(destDir, `${filename}-thumb.webp`), thumbBuffer);
      }
      return true;
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw error;
      }
    }
  }
  return false;
};
