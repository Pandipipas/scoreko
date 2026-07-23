import { ref, watch } from 'vue';
import en from './locales/en.json';
import es from './locales/es.json';
import { graphicsSettingsReplicant } from '../../browser_shared/replicants';

export type Locale = 'en' | 'es';

type Translations = typeof en;

const STORAGE_KEY = 'scoreko.language';

const messages: Record<Locale, Translations> = {
  en,
  es,
};

const normalizeLocale = (value?: unknown): Locale => {
  if (value === 'es') return 'es';
  return 'en';
};

const getStoredLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  return normalizeLocale(localStorage.getItem(STORAGE_KEY));
};

export const locale = ref<Locale>(getStoredLocale());

watch(() => graphicsSettingsReplicant?.data?.locale, (newLocale) => {
  if (newLocale && newLocale !== locale.value) {
    locale.value = normalizeLocale(newLocale);
  }
});

export const setLocale = (value: Locale) => {
  locale.value = normalizeLocale(value);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale.value);
  }
  if (graphicsSettingsReplicant && graphicsSettingsReplicant.data) {
    graphicsSettingsReplicant.data.locale = locale.value;
  }
};

export const t = (key: keyof Translations): string => {
  const currentLocale = locale.value;
  const bundle = messages[currentLocale] || messages.en;
  return bundle[key] || messages.en[key] || key;
};

