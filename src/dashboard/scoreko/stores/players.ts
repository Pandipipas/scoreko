import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref } from 'vue';
import { playersReplicant } from '../../../browser_shared/replicants';
import type { Schemas } from '../../../types';
import { readStorageSnapshot, syncStateWithReplicant } from './store-sync';
import { LS_KEYS } from '../../../shared/constants';

type PlayersMap = Schemas.Players;
type Player = PlayersMap[string];

const STORAGE_KEY = LS_KEYS.PLAYERS;

const normalizePlayer = (input: unknown): Player => {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return {
    gamertag: typeof candidate.gamertag === 'string' ? candidate.gamertag : '',
    name: typeof candidate.name === 'string' ? candidate.name : '',
    team: typeof candidate.team === 'string' ? candidate.team : '',
    country: typeof candidate.country === 'string' ? candidate.country : '',
    twitter: typeof candidate.twitter === 'string' ? candidate.twitter : '',
  };
};

const normalizePlayers = (input: unknown): PlayersMap => {
  if (typeof input !== 'object' || input === null) {
    return {};
  }
  const result: PlayersMap = {};
  Object.entries(input as Record<string, unknown>).forEach(([id, value]) => {
    if (!id) {
      return;
    }
    result[id] = normalizePlayer(value);
  });
  return result;
};

export const usePlayersStore = defineStore('players', () => {
  const players = ref<PlayersMap>({});
  const temporaryPlayersMeta = ref<Record<string, 'startgg' | 'challonge'>>({});

  const loadTemporaryPlayersMeta = () => {
    if (typeof window === 'undefined') return;
    const nextMeta: Record<string, 'startgg' | 'challonge'> = {};
    const parse = (key: string, source: 'startgg' | 'challonge') => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          Object.keys(parsed).forEach(id => {
            nextMeta[id] = source;
          });
        }
      } catch (err) {
        console.warn(`[players] Failed to parse localStorage key "${key}":`, err);
      }
    };
    parse(LS_KEYS.STARTGG_TEMP_PLAYERS, 'startgg');
    parse(LS_KEYS.CHALLONGE_TEMP_PLAYERS, 'challonge');
    temporaryPlayersMeta.value = nextMeta;
  };

  const replicant = playersReplicant;
  const storageSnapshot = readStorageSnapshot(STORAGE_KEY, normalizePlayers);
  if (storageSnapshot) {
    players.value = storageSnapshot;
  }

  syncStateWithReplicant(players, replicant, normalizePlayers, STORAGE_KEY);
  loadTemporaryPlayersMeta();

  if (typeof window !== 'undefined') {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LS_KEYS.STARTGG_TEMP_PLAYERS || e.key === LS_KEYS.CHALLONGE_TEMP_PLAYERS) {
        loadTemporaryPlayersMeta();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    onScopeDispose(() => {
      window.removeEventListener('storage', handleStorageChange);
    });
  }

  const setPlayers = (value: PlayersMap) => {
    players.value = normalizePlayers(value);
  };

  const upsertPlayer = (id: string, player: Player) => {
    players.value = {
      ...players.value,
      [id]: normalizePlayer(player),
    };
    
    loadTemporaryPlayersMeta();
  };

  const removePlayer = (id: string) => {
    const next = { ...players.value };
    delete next[id];
    players.value = next;
    
    loadTemporaryPlayersMeta();
  };

  const rows = computed(() => Object.entries(players.value).map(([id, player]) => ({
    id,
    ...player,
  })));

  
  const tempKeys = [LS_KEYS.STARTGG_TEMP_PLAYERS, LS_KEYS.CHALLONGE_TEMP_PLAYERS];
  const cleanupInterval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    tempKeys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const meta = JSON.parse(raw) as Record<string, { expiresAt: number }>;
        let changed = false;
        const nextMeta = { ...meta };

        for (const [id, data] of Object.entries(meta)) {
          if (data && data.expiresAt <= now) {
            removePlayer(id);
            delete nextMeta[id];
            changed = true;
          }
        }

        if (changed) {
          localStorage.setItem(key, JSON.stringify(nextMeta));
        }
      } catch (err) {
        console.warn(`[players] Failed to process temp players expiry for key "${key}":`, err);
      }
    });
    loadTemporaryPlayersMeta();
  }, 60 * 1000);

  onScopeDispose(() => clearInterval(cleanupInterval));

  return {
    players,
    temporaryPlayersMeta,
    rows,
    setPlayers,
    upsertPlayer,
    removePlayer,
    loadTemporaryPlayersMeta,
  };
});
