import { defineStore } from 'pinia';
import { reactive } from 'vue';

export type ShortcutAction = 'leftIncrement' | 'leftDecrement' | 'rightIncrement' | 'rightDecrement' | 'swapSides';
export type ShortcutSettings = Record<ShortcutAction, string>;

import { LS_KEYS } from '../../../shared/constants';

type ShortcutParts = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

const STORAGE_KEY = LS_KEYS.SHORTCUT_SETTINGS;

const defaultShortcuts: ShortcutSettings = {
  leftIncrement: 'Q',
  leftDecrement: 'A',
  rightIncrement: 'P',
  rightDecrement: 'L',
  swapSides: 'S',
};

const normalizeKey = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  return normalized.length === 1 ? normalized.toUpperCase() : '';
};

const normalizeShortcut = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const parts = value.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }

  const modifiers = {
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
  };

  let key = '';
  for (const part of parts) {
    const lowered = part.toLowerCase();
    if (lowered === 'alt') {
      modifiers.altKey = true;
      continue;
    }
    if (lowered === 'ctrl' || lowered === 'control') {
      modifiers.ctrlKey = true;
      continue;
    }
    if (lowered === 'shift') {
      modifiers.shiftKey = true;
      continue;
    }
    if (lowered === 'meta' || lowered === 'cmd' || lowered === 'command') {
      modifiers.metaKey = true;
      continue;
    }

    key = normalizeKey(part);
  }

  if (!key) {
    return '';
  }

  return formatShortcut({ key, ...modifiers });
};

const normalizeSettings = (input: unknown): ShortcutSettings => {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  return {
    leftIncrement: normalizeShortcut(candidate.leftIncrement) || defaultShortcuts.leftIncrement,
    leftDecrement: normalizeShortcut(candidate.leftDecrement) || defaultShortcuts.leftDecrement,
    rightIncrement: normalizeShortcut(candidate.rightIncrement) || defaultShortcuts.rightIncrement,
    rightDecrement: normalizeShortcut(candidate.rightDecrement) || defaultShortcuts.rightDecrement,
    swapSides: normalizeShortcut(candidate.swapSides) || defaultShortcuts.swapSides,
  };
};

const readStoredSettings = (): ShortcutSettings => {
  if (typeof window === 'undefined') {
    return { ...defaultShortcuts };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultShortcuts };
    }

    return normalizeSettings(JSON.parse(raw));
  } catch (err) {
    console.warn('[shortcut-settings] Failed to parse localStorage:', err);
    return { ...defaultShortcuts };
  }
};

const persistSettings = (settings: ShortcutSettings) => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const formatShortcut = ({ key, altKey, ctrlKey, shiftKey, metaKey }: ShortcutParts): string => {
  const parts: string[] = [];
  if (ctrlKey) {
    parts.push('Ctrl');
  }
  if (altKey) {
    parts.push('Alt');
  }
  if (shiftKey) {
    parts.push('Shift');
  }
  if (metaKey) {
    parts.push('Meta');
  }
  parts.push(key);
  return parts.join('+');
};

export const eventToShortcut = (event: KeyboardEvent): string => {
  const key = normalizeKey(event.key);
  if (!key) {
    return '';
  }

  return formatShortcut({
    key,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
  });
};

export const isShortcutMatch = (event: KeyboardEvent, shortcut: string): boolean => {
  const normalizedShortcut = normalizeShortcut(shortcut);
  if (!normalizedShortcut) {
    return false;
  }

  return eventToShortcut(event) === normalizedShortcut;
};

export const useShortcutSettingsStore = defineStore('shortcutSettings', () => {
  const shortcuts = reactive<ShortcutSettings>(readStoredSettings());

  const setShortcut = (action: ShortcutAction, value: string) => {
    const normalized = normalizeShortcut(value);
    if (!normalized) {
      return;
    }

    shortcuts[action] = normalized;
    persistSettings(shortcuts);
  };

  const resetShortcuts = () => {
    shortcuts.leftIncrement = defaultShortcuts.leftIncrement;
    shortcuts.leftDecrement = defaultShortcuts.leftDecrement;
    shortcuts.rightIncrement = defaultShortcuts.rightIncrement;
    shortcuts.rightDecrement = defaultShortcuts.rightDecrement;
    shortcuts.swapSides = defaultShortcuts.swapSides;
    persistSettings(shortcuts);
  };

  const resetShortcut = (action: ShortcutAction) => {
    shortcuts[action] = defaultShortcuts[action];
    persistSettings(shortcuts);
  };

  return {
    shortcuts,
    setShortcut,
    resetShortcuts,
    resetShortcut,
  };
});