import { getData } from 'country-list';

const baseCountries = getData();
const countryByCode = new Map<string, string>();
const countryByName = new Map<string, string>();
for (const country of baseCountries) {
  countryByCode.set(country.code, country.name);
  countryByName.set(country.name.toLowerCase(), country.code);
}

export const resolveCountryCode = (country: string | null | undefined): string => {
  const raw = (country ?? '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (countryByCode.has(upper)) return upper;
  return countryByName.get(raw.toLowerCase()) ?? '';
};

export const getStringProp = (payload: unknown, key: string): string => {
  if (typeof payload !== 'object' || payload === null || !(key in payload)) return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
};

export const sendAck = (ack: unknown, error: string | null, response?: unknown) => {
  if (typeof ack === 'function') ack(error, response);
};

export const validatePacksUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

