import { computed, ref, watch, type InjectionKey, type Ref } from 'vue';
import { getCharactersByGame, getDefaultCharactersByGame, installedPacksRevision } from '../../../shared/fighting-characters';
import type { GameSelectOption } from '../../../shared/pack-types';
import { useScoreboardStore } from '../stores/scoreboard';
import { usePacksStore } from '../stores/packs';


export type CharacterOption = ReturnType<typeof getCharactersByGame>[number];
export type CharacterGameContext = ReturnType<typeof useCharacterGame>;
export const CHARACTER_GAME_KEY: InjectionKey<CharacterGameContext> = Symbol('characterGame');


export function useCharacterGame() {
  const scoreboardStore = useScoreboardStore();
  const packRegistry = usePacksStore();

  const gameInput = ref('');

  const fightingGameOptions = ref<GameSelectOption[]>([]);

  watch(
    () => packRegistry.allGameOptions,
    (options) => {
      fightingGameOptions.value = options.filter((o) => o.available);
    },
  );

  const handleGameSelect = (gameName: string) => {
    scoreboardStore.updateGame(gameName);
  };

  const characterOptions = computed(() => {
    void installedPacksRevision.value;
    return getCharactersByGame(scoreboardStore.scoreboard.game);
  });
  const leftCharacterOptions = ref<CharacterOption[]>([]);
  const rightCharacterOptions = ref<CharacterOption[]>([]);
  const leftCharacterInput = ref('');
  const rightCharacterInput = ref('');

  const charactersByGame = ref<Record<string, { leftCharacter: string; rightCharacter: string }>>({});

  const leftCharacterImage = computed(() => {
    const match = characterOptions.value.find(
      (o) => o.value === scoreboardStore.scoreboard.leftCharacter,
    );
    return match?.image ?? '';
  });

  const rightCharacterImage = computed(() => {
    const match = characterOptions.value.find(
      (o) => o.value === scoreboardStore.scoreboard.rightCharacter,
    );
    return match?.image ?? '';
  });

  function createClearableFilter(
    baseFilter: (value: string, update: (fn: () => void) => void) => void,
    onClear: () => void
  ) {
    const justFocused = ref(false);
    const manuallyCleared = ref(false);

    return {
      onFocus() {
        justFocused.value = true;
        manuallyCleared.value = false;
      },
      onBlur() {
        if (manuallyCleared.value) {
          onClear();
          manuallyCleared.value = false;
        }
      },
      onFilter(val: string, update: (fn: () => void) => void) {
        baseFilter(val, (fn) => {
          update(() => {
            if (justFocused.value) {
              justFocused.value = false;
              if (val === '') {
                fn();
                return;
              }
            }

            manuallyCleared.value = (val === '');

            fn();
          });
        });
      }
    };
  }

  const baseGameFilter = (value: string, update: (fn: () => void) => void) => {
    update(() => {
      const needle = value.toLowerCase().trim();
      const availableOptions = packRegistry.allGameOptions.filter((g) => g.available);
      fightingGameOptions.value = needle
        ? availableOptions.filter((g) =>
            g.label.toLowerCase().includes(needle),
          )
        : availableOptions;
    });
  };

  const makeCharacterFilter =
    (target: Ref<CharacterOption[]>) =>
    (value: string, update: (fn: () => void) => void) => {
      update(() => {
        const needle = value.toLowerCase().trim();
        target.value = needle
          ? characterOptions.value.filter((c) => c.label.toLowerCase().includes(needle))
          : characterOptions.value;
      });
    };

  const {
    onFocus: onGameFocus,
    onBlur: onGameBlur,
    onFilter: onGameFilter,
  } = createClearableFilter(baseGameFilter, () => scoreboardStore.updateGame(''));

  const baseLeftCharacterFilter = makeCharacterFilter(leftCharacterOptions);
  const baseRightCharacterFilter = makeCharacterFilter(rightCharacterOptions);

  const {
    onFocus: onLeftCharacterFocus,
    onBlur: onLeftCharacterBlur,
    onFilter: onLeftCharacterFilter,
  } = createClearableFilter(baseLeftCharacterFilter, () => scoreboardStore.updateCharacter('left', ''));

  const {
    onFocus: onRightCharacterFocus,
    onBlur: onRightCharacterBlur,
    onFilter: onRightCharacterFilter,
  } = createClearableFilter(baseRightCharacterFilter, () => scoreboardStore.updateCharacter('right', ''));

  watch(
    () => scoreboardStore.scoreboard.game,
    (value) => {
      const match = fightingGameOptions.value.find((o) => o.value === value);
      gameInput.value = match?.label ?? value;
    },
    { immediate: true },
  );

  watch(
    () => scoreboardStore.scoreboard.game,
    (newGame, previousGame) => {
      if (previousGame) {
        charactersByGame.value[previousGame] = {
          leftCharacter: scoreboardStore.scoreboard.leftCharacter,
          rightCharacter: scoreboardStore.scoreboard.rightCharacter,
        };
      }

      const options = getCharactersByGame(newGame);

      if (newGame && options.length === 0) return;

      leftCharacterOptions.value = options;
      rightCharacterOptions.value = options;
      const allowed = new Set(options.map((o) => o.value));
      const saved = newGame ? charactersByGame.value[newGame] : undefined;

      const { leftCharacter: curLeft, rightCharacter: curRight } = scoreboardStore.scoreboard;
      let nextLeft = saved?.leftCharacter ?? curLeft;
      let nextRight = saved?.rightCharacter ?? curRight;

      if (!allowed.has(nextLeft)) nextLeft = '';
      if (!allowed.has(nextRight)) nextRight = '';

      const defaults = getDefaultCharactersByGame(newGame);
      if (defaults) {
        if (!nextLeft) nextLeft = allowed.has(defaults.leftCharacter) ? defaults.leftCharacter : '';
        if (!nextRight) nextRight = allowed.has(defaults.rightCharacter) ? defaults.rightCharacter : '';
      }

      if (allowed.has(nextLeft)) {
        scoreboardStore.updateCharacter('left', nextLeft);
      } else if (!allowed.has(scoreboardStore.scoreboard.leftCharacter)) {
        scoreboardStore.updateCharacter('left', '');
        leftCharacterInput.value = '';
      }

      if (allowed.has(nextRight)) {
        scoreboardStore.updateCharacter('right', nextRight);
      } else if (!allowed.has(scoreboardStore.scoreboard.rightCharacter)) {
        scoreboardStore.updateCharacter('right', '');
        rightCharacterInput.value = '';
      }
    },
    { immediate: true },
  );

  watch(
    () => scoreboardStore.scoreboard.leftCharacter,
    (value) => {
      const match = characterOptions.value.find((o) => o.value === value);
      leftCharacterInput.value = match?.label ?? '';
      const game = scoreboardStore.scoreboard.game;
      if (game) {
        charactersByGame.value[game] = {
          leftCharacter: value,
          rightCharacter: scoreboardStore.scoreboard.rightCharacter,
        };
      }
    },
    { immediate: true },
  );

  watch(
    () => scoreboardStore.scoreboard.rightCharacter,
    (value) => {
      const match = characterOptions.value.find((o) => o.value === value);
      rightCharacterInput.value = match?.label ?? '';
      const game = scoreboardStore.scoreboard.game;
      if (game) {
        charactersByGame.value[game] = {
          leftCharacter: scoreboardStore.scoreboard.leftCharacter,
          rightCharacter: value,
        };
      }
    },
    { immediate: true },
  );

  watch(installedPacksRevision, () => {
    const game = scoreboardStore.scoreboard.game;
    if (!game) return;

    const options = getCharactersByGame(game);
    if (options.length === 0) return;

    const allowed = new Set(options.map((o) => o.value));
    leftCharacterOptions.value = options;
    rightCharacterOptions.value = options;

    const { leftCharacter, rightCharacter } = scoreboardStore.scoreboard;

    if (leftCharacter && allowed.has(leftCharacter)) {
      leftCharacterInput.value = options.find((o) => o.value === leftCharacter)?.label ?? '';
    } else if (leftCharacter && !allowed.has(leftCharacter)) {
      scoreboardStore.updateCharacter('left', '');
      leftCharacterInput.value = '';
    }

    if (rightCharacter && allowed.has(rightCharacter)) {
      rightCharacterInput.value = options.find((o) => o.value === rightCharacter)?.label ?? '';
    } else if (rightCharacter && !allowed.has(rightCharacter)) {
      scoreboardStore.updateCharacter('right', '');
      rightCharacterInput.value = '';
    }
  });

  return {
    gameInput,
    fightingGameOptions,
    onGameFilter,
    onGameFocus,
    onGameBlur,
    handleGameSelect,
    leftCharacterOptions,
    rightCharacterOptions,
    leftCharacterInput,
    rightCharacterInput,
    leftCharacterImage,
    rightCharacterImage,
    onLeftCharacterFilter,
    onLeftCharacterFocus,
    onLeftCharacterBlur,
    onRightCharacterFilter,
    onRightCharacterFocus,
    onRightCharacterBlur,
  };
}
