import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nodecg } from './nodecg.js';

const KEY_FILE = path.join(process.cwd(), 'cfg', 'scoreko-encryption-key.txt');

let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;

  try {
    if (fs.existsSync(KEY_FILE)) {
      const hexKey = fs.readFileSync(KEY_FILE, 'utf-8').trim();
      encryptionKey = Buffer.from(hexKey, 'hex');
    } else {
      const newKey = crypto.randomBytes(32);
      fs.writeFileSync(KEY_FILE, newKey.toString('hex'), { mode: 0o600 });
      encryptionKey = newKey;
    }
  } catch (err) {
    nodecg.log.error('[token-store] Failed to load or generate encryption key:', err instanceof Error ? err.message : err);
    throw new Error('Encryption key unavailable');
  }

  return encryptionKey;
}

function encryptString(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

function decryptString(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted string format');

  const iv = Buffer.from(parts[0]!, 'hex');
  const encrypted = Buffer.from(parts[1]!, 'hex');
  const authTag = Buffer.from(parts[2]!, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

const tokenReplicant = nodecg.Replicant<Record<string, string>>('integration_tokens', {
  defaultValue: {},
  persistent: true,
});

const authStateReplicant = nodecg.Replicant<Record<string, boolean>>('integration_auth_state', {
  defaultValue: {},
  persistent: false, 
});

export const tokenStore = {
  setToken(integration: string, token: string): void {
    if (!token) {
      delete tokenReplicant.value[integration];
      authStateReplicant.value[integration] = false;
      return;
    }

    try {
      tokenReplicant.value[integration] = encryptString(token);
      authStateReplicant.value[integration] = true;
    } catch (err) {
      nodecg.log.error(`[token-store] Failed to encrypt token for ${integration}:`, err instanceof Error ? err.message : err);
    }
  },

  getToken(integration: string): string | null {
    const ciphertext = tokenReplicant.value[integration];
    if (!ciphertext) return null;

    try {
      return decryptString(ciphertext);
    } catch (err) {
      nodecg.log.error(`[token-store] Failed to decrypt token for ${integration}:`, err instanceof Error ? err.message : err);
      return null;
    }
  },

  hasToken(integration: string): boolean {
    return Boolean(tokenReplicant.value[integration]);
  },
};

nodecg.listenFor('syncAuthState', (_data: unknown, ack) => {
  try {
    if (ack && !ack.handled) {
      ack(null, authStateReplicant.value);
    }
  } catch (err) {
    if (ack && !ack.handled) {
      ack(err instanceof Error ? err.message : 'Unexpected error in syncAuthState');
    }
  }
});

for (const integration of Object.keys(tokenReplicant.value)) {
  authStateReplicant.value[integration] = true;
}
