import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { scoreboardReplicant } from '../../../browser_shared/replicants';
import type { Schemas } from '../../../types';
import { readStorageSnapshot, syncStateWithReplicant } from './store-sync';
import { CUSTOM_LEFT_PLAYER_ID, CUSTOM_RIGHT_PLAYER_ID } from '../composables/usePlayerSide';
import { LS_KEYS } from '../../../shared/constants';

type Scoreboard = Schemas.Scoreboard;

const STORAGE_KEY = LS_KEYS.SCOREBOARD;

const defaultScoreboard: Scoreboard = {
  leftPlayerId: '',
  rightPlayerId: '',
  leftNameOverride: '',
  rightNameOverride: '',
  leftTeamOverride: '',
  rightTeamOverride: '',
  leftCountryOverride: '',
  rightCountryOverride: '',
  leftCharacter: '',
  rightCharacter: '',
  leftScore: 0,
  rightScore: 0,
  round: '',
  game: '',
  leftBracketStatus: '',
  rightBracketStatus: '',
};

const normalizeScoreboard = (input: unknown): Scoreboard => {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return {
    leftPlayerId: typeof candidate.leftPlayerId === 'string' ? candidate.leftPlayerId : '',
    rightPlayerId: typeof candidate.rightPlayerId === 'string' ? candidate.rightPlayerId : '',
    leftNameOverride: typeof candidate.leftNameOverride === 'string' ? candidate.leftNameOverride : '',
    rightNameOverride: typeof candidate.rightNameOverride === 'string' ? candidate.rightNameOverride : '',
    leftTeamOverride: typeof candidate.leftTeamOverride === 'string' ? candidate.leftTeamOverride : '',
    rightTeamOverride: typeof candidate.rightTeamOverride === 'string' ? candidate.rightTeamOverride : '',
    leftCountryOverride: typeof candidate.leftCountryOverride === 'string' ? candidate.leftCountryOverride : '',
    rightCountryOverride: typeof candidate.rightCountryOverride === 'string' ? candidate.rightCountryOverride : '',
    leftCharacter: typeof candidate.leftCharacter === 'string' ? candidate.leftCharacter : '',
    rightCharacter: typeof candidate.rightCharacter === 'string' ? candidate.rightCharacter : '',
    leftScore: typeof candidate.leftScore === 'number' ? Math.max(0, Math.floor(candidate.leftScore)) : 0,
    rightScore: typeof candidate.rightScore === 'number' ? Math.max(0, Math.floor(candidate.rightScore)) : 0,
    round: typeof candidate.round === 'string' ? candidate.round : '',
    game: typeof candidate.game === 'string' ? candidate.game : '',
    leftBracketStatus: typeof candidate.leftBracketStatus === 'string' ? candidate.leftBracketStatus : '',
    rightBracketStatus: typeof candidate.rightBracketStatus === 'string' ? candidate.rightBracketStatus : '',
  };
};

export const useScoreboardStore = defineStore('scoreboard', () => {
  const scoreboard = ref<Scoreboard>({ ...defaultScoreboard });
  const replicant = scoreboardReplicant;
  const storageSnapshot = readStorageSnapshot(STORAGE_KEY, normalizeScoreboard);
  if (storageSnapshot) {
    scoreboard.value = storageSnapshot;
  }

  syncStateWithReplicant(scoreboard, replicant, normalizeScoreboard, STORAGE_KEY);

  const setScoreboard = (value: Scoreboard) => {
    scoreboard.value = normalizeScoreboard(value);
  };

  const swapPlayers = () => {
    let newLeftId = scoreboard.value.rightPlayerId;
    let newRightId = scoreboard.value.leftPlayerId;

    if (newLeftId === CUSTOM_RIGHT_PLAYER_ID) newLeftId = CUSTOM_LEFT_PLAYER_ID;
    if (newRightId === CUSTOM_LEFT_PLAYER_ID) newRightId = CUSTOM_RIGHT_PLAYER_ID;

    scoreboard.value = {
      ...scoreboard.value,
      leftPlayerId: newLeftId,
      rightPlayerId: newRightId,
      leftNameOverride: scoreboard.value.rightNameOverride,
      rightNameOverride: scoreboard.value.leftNameOverride,
      leftTeamOverride: scoreboard.value.rightTeamOverride,
      rightTeamOverride: scoreboard.value.leftTeamOverride,
      leftCountryOverride: scoreboard.value.rightCountryOverride,
      rightCountryOverride: scoreboard.value.leftCountryOverride,
      leftCharacter: scoreboard.value.rightCharacter,
      rightCharacter: scoreboard.value.leftCharacter,
      leftScore: scoreboard.value.rightScore,
      rightScore: scoreboard.value.leftScore,
      leftBracketStatus: scoreboard.value.rightBracketStatus,
      rightBracketStatus: scoreboard.value.leftBracketStatus,
    };
  };

  const clearAll = () => {
    scoreboard.value = {
      ...scoreboard.value,
      leftPlayerId: '',
      rightPlayerId: '',
      leftNameOverride: '',
      rightNameOverride: '',
      leftTeamOverride: '',
      rightTeamOverride: '',
      leftCountryOverride: '',
      rightCountryOverride: '',
      leftScore: 0,
      rightScore: 0,
    };
  };

  const updateRound = (round: string) => {
    scoreboard.value = { ...scoreboard.value, round };
  };

  const incrementLeftScore = () => {
    scoreboard.value = {
      ...scoreboard.value,
      leftScore: scoreboard.value.leftScore + 1,
    };
  };

  const decrementLeftScore = () => {
    scoreboard.value = {
      ...scoreboard.value,
      leftScore: Math.max(0, scoreboard.value.leftScore - 1),
    };
  };

  const incrementRightScore = () => {
    scoreboard.value = {
      ...scoreboard.value,
      rightScore: scoreboard.value.rightScore + 1,
    };
  };

  const decrementRightScore = () => {
    scoreboard.value = {
      ...scoreboard.value,
      rightScore: Math.max(0, scoreboard.value.rightScore - 1),
    };
  };

  const updateGame = (game: string) => {
    scoreboard.value = { ...scoreboard.value, game };
  };

  const updateCharacter = (side: 'left' | 'right', character: string) => {
    if (side === 'left') {
      scoreboard.value = { ...scoreboard.value, leftCharacter: character };
    } else {
      scoreboard.value = { ...scoreboard.value, rightCharacter: character };
    }
  };

  
  const updatePlayerField = <K extends 'PlayerId' | 'NameOverride' | 'TeamOverride' | 'CountryOverride'>(
    side: 'left' | 'right',
    field: K,
    value: string,
  ) => {
    const key = (side === 'left' ? `left${field}` : `right${field}`) as keyof Scoreboard;
    scoreboard.value = { ...scoreboard.value, [key]: value };
  };

  const setGrandFinalsAdvantage = (side: 'left' | 'right') => {
    const isAlreadyWinners = side === 'left' ? scoreboard.value.leftBracketStatus === 'W' : scoreboard.value.rightBracketStatus === 'W';
    if (isAlreadyWinners) {
      clearBracketStatus();
      return;
    }
    scoreboard.value = {
      ...scoreboard.value,
      leftBracketStatus: side === 'left' ? 'W' : 'L',
      rightBracketStatus: side === 'right' ? 'W' : 'L',
    };
  };

  const clearBracketStatus = () => {
    scoreboard.value = {
      ...scoreboard.value,
      leftBracketStatus: '',
      rightBracketStatus: '',
    };
  };

  const leftScore = computed({
    get: () => scoreboard.value.leftScore,
    set: (value: number) => {
      scoreboard.value = {
        ...scoreboard.value,
        leftScore: Math.max(0, Math.floor(value)),
      };
    },
  });

  const rightScore = computed({
    get: () => scoreboard.value.rightScore,
    set: (value: number) => {
      scoreboard.value = {
        ...scoreboard.value,
        rightScore: Math.max(0, Math.floor(value)),
      };
    },
  });

  return {
    scoreboard,
    leftScore,
    rightScore,
    setScoreboard,
    swapPlayers,
    clearAll,
    updateRound,
    incrementLeftScore,
    decrementLeftScore,
    incrementRightScore,
    decrementRightScore,
    updateGame,
    updateCharacter,
    updatePlayerField,
    setGrandFinalsAdvantage,
    clearBracketStatus,
  };
});
