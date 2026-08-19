import { computed, ref, watch, watchEffect } from 'vue';
import { useScoreboardStore } from '../stores/scoreboard';
import { usePlayersStore } from '../stores/players';
import type { Schemas } from '../../../types';
import { useCountryFilter } from './useCountryFilter';

export const CUSTOM_LEFT_PLAYER_ID = '__custom_left_player__';
export const CUSTOM_RIGHT_PLAYER_ID = '__custom_right_player__';

const normalizeName = (value: string) => value.trim().toLowerCase();

const createPlayerId = (name: string, players: Schemas.Players): string => {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-') || 'player';

  let index = 1;
  let candidate = base;
  while (players[candidate]) {
    index += 1;
    candidate = `${base}-${index}`;
  }
  return candidate;
};

export function usePlayerSide(side: 'left' | 'right') {
  const scoreboardStore = useScoreboardStore();
  const playersStore = usePlayersStore();

  const isLeft = side === 'left';
  const CUSTOM_ID = isLeft ? CUSTOM_LEFT_PLAYER_ID : CUSTOM_RIGHT_PLAYER_ID;

  

  const playerId = computed({
    get: () => (isLeft ? scoreboardStore.scoreboard.leftPlayerId : scoreboardStore.scoreboard.rightPlayerId),
    set: (v) => scoreboardStore.updatePlayerField(side, 'PlayerId', v),
  });

  const nameOverride = computed({
    get: () => (isLeft ? scoreboardStore.scoreboard.leftNameOverride : scoreboardStore.scoreboard.rightNameOverride),
    set: (v) => scoreboardStore.updatePlayerField(side, 'NameOverride', v),
  });

  const teamOverride = computed({
    get: () => (isLeft ? scoreboardStore.scoreboard.leftTeamOverride : scoreboardStore.scoreboard.rightTeamOverride),
    set: (v) => scoreboardStore.updatePlayerField(side, 'TeamOverride', v),
  });

  const countryOverride = computed({
    get: () => (isLeft ? scoreboardStore.scoreboard.leftCountryOverride : scoreboardStore.scoreboard.rightCountryOverride),
    set: (v) => scoreboardStore.updatePlayerField(side, 'CountryOverride', v),
  });

  const filter = ref('');
  const inputValue = ref('');
  const focused = ref(false);
  const justFocused = ref(false);
  const userManuallyCleared = ref(false);

  const {
    countryInput,
    filteredOptions: filteredCountryOptions,
    onFilter: onCountryFilter,
    onFocus: onCountryFocus,
    onBlur: onCountryBlur,
  } = useCountryFilter(
    () => countryOverride.value,
    () => { countryOverride.value = ''; }
  );

  const allPlayerOptions = computed(() => {
    const entries = Object.entries(playersStore.players) as [string, Schemas.Players[string]][];
    return entries.map(([id, player]) => {
      const source = playersStore.temporaryPlayersMeta[id] ?? null;

      return {
        value: id,
        label: player.gamertag || id,
        source,
      };
    });
  });

  
  
  const playerOptions = computed(() => {
    const needle = filter.value.toLowerCase();
    const options = needle
      ? allPlayerOptions.value.filter((o) => o.label.toLowerCase().includes(needle))
      : allPlayerOptions.value;

    if (playerId.value === CUSTOM_ID && nameOverride.value.trim()) {
      return [{ value: CUSTOM_ID, label: nameOverride.value }, ...options];
    }
    return options;
  });

  const selectedPlayer = computed(() => playersStore.players[playerId.value]);

  const getPlayerLabel = (id: string): string => {
    if (id === CUSTOM_ID) return nameOverride.value;
    return allPlayerOptions.value.find((o) => o.value === id)?.label ?? '';
  };

  const playerExistsByGamertag = (name: string): boolean => {
    const normalized = normalizeName(name);
    return Boolean(normalized)
      && Object.values(playersStore.players).some(
        (p) => normalizeName(p.gamertag || '') === normalized,
      );
  };

  const displayName = computed(
    () => nameOverride.value || getPlayerLabel(playerId.value),
  );

  
  const canSave = computed(
    () => Boolean(nameOverride.value.trim()) && !playerExistsByGamertag(nameOverride.value),
  );

  const teamChanged = computed(() => {
    const player = selectedPlayer.value;
    if (!player) return false;
    return player.team !== teamOverride.value;
  });

  const countryChanged = computed(() => {
    const player = selectedPlayer.value;
    if (!player) return false;
    return player.country !== countryOverride.value;
  });

  
  const pendingGamertag = computed(
    () => (nameOverride.value.trim() || selectedPlayer.value?.gamertag) ?? '',
  );

  const nameChanged = computed(() => {
    const player = selectedPlayer.value;
    if (!player) return false;
    return player.gamertag !== pendingGamertag.value;
  });

  
  const canSaveNameChange = computed(
    () => nameChanged.value && !playerExistsByGamertag(pendingGamertag.value),
  );

  
  const showsNameSave = computed(() => canSave.value || canSaveNameChange.value);

  const startCustomPlayer = () => {
    const wasCustom = playerId.value === CUSTOM_ID;
    playerId.value = CUSTOM_ID;
    if (!wasCustom) {
      teamOverride.value = '';
      countryOverride.value = '';
    }
  };

  const applyPlayerData = (id: string) => {
    const player = playersStore.players[id];
    if (!player) return;
    teamOverride.value = player.team ?? '';
    countryOverride.value = player.country ?? '';
  };

  const onFilter = (val: string, update: (fn: () => void) => void) => {
    update(() => {
      filter.value = val;
      if (!focused.value) return;

      if (justFocused.value) {
        justFocused.value = false;
        if (val === '') {
          if (playerId.value === CUSTOM_ID) {
            inputValue.value = nameOverride.value;
            return;
          }
          inputValue.value = '';
          return;
        }
      }

      userManuallyCleared.value = (val === '');

      inputValue.value = val;
      nameOverride.value = val;
      if (val.trim()) startCustomPlayer();
    });
  };

  const onFocus = () => {
    focused.value = true;
    justFocused.value = true;
    userManuallyCleared.value = false;
    inputValue.value = displayName.value;
  };

  const onBlur = () => {
    focused.value = false;
    filter.value = '';

    if (userManuallyCleared.value) {
      playerId.value = '';
      nameOverride.value = '';
      teamOverride.value = '';
      countryOverride.value = '';
      userManuallyCleared.value = false;
    }

    inputValue.value = displayName.value;
  };

  const onSelect = (id: string) => {
    focused.value = false;
    filter.value = '';

    if (!id) {
      nameOverride.value = '';
      teamOverride.value = '';
      countryOverride.value = '';
      inputValue.value = getPlayerLabel('');
      return;
    }

    if (!playersStore.players[id]) return;

    nameOverride.value = '';
    inputValue.value = getPlayerLabel(id);
    applyPlayerData(id);
  };

  
  const savePlayer = () => {
    const gamertag = nameOverride.value.trim();
    if (!gamertag || playerExistsByGamertag(gamertag)) return;
    const id = createPlayerId(gamertag, playersStore.players);
    playersStore.upsertPlayer(id, {
      gamertag,
      name: '',
      team: teamOverride.value,
      country: countryOverride.value,
      twitter: '',
    });
    playerId.value = id;
    nameOverride.value = '';
    inputValue.value = gamertag;
  };

  
  const saveNameChange = () => {
    const player = selectedPlayer.value;
    if (!player || !canSaveNameChange.value) return;
    playersStore.upsertPlayer(playerId.value, { ...player, gamertag: pendingGamertag.value });
    nameOverride.value = '';
  };

  const saveTeamChange = () => {
    const player = selectedPlayer.value;
    if (!player) return;
    playersStore.upsertPlayer(playerId.value, { ...player, team: teamOverride.value });
  };

  const saveCountryChange = () => {
    const player = selectedPlayer.value;
    if (!player) return;
    playersStore.upsertPlayer(playerId.value, { ...player, country: countryOverride.value });
  };

  
  const onNameSave = () => {
    if (canSave.value) {
      savePlayer();
      return;
    }
    saveNameChange();
  };

  watch(playerId, (id) => applyPlayerData(id), { immediate: true });

  watch(selectedPlayer, (player) => {
    if (!player && playerId.value && playerId.value !== CUSTOM_ID) {
      playerId.value = '';
      onSelect('');
    }
  }, { immediate: true });

  watchEffect(() => {
    if (!focused.value) {
      inputValue.value = displayName.value;
    }
  });

  return {
    playerId,
    nameOverride,
    teamOverride,
    countryOverride,
    inputValue,
    countryInput,
    filteredCountryOptions,
    playerOptions,
    displayName,
    teamChanged,
    countryChanged,
    showsNameSave,
    onFilter,
    onFocus,
    onBlur,
    onSelect,
    onNameSave,
    saveTeamChange,
    saveCountryChange,
    onCountryFilter,
    onCountryFocus,
    onCountryBlur,
  };
}