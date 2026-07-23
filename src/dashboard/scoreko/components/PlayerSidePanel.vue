<script setup lang="ts">
defineOptions({ name: 'PlayerSidePanel' });
import { computed, inject } from 'vue';
import { CHARACTER_GAME_KEY } from '../composables/useCharacterGame';
import { usePlayerSide } from '../composables/usePlayerSide';
import { t } from '../i18n';
import { useScoreboardStore } from '../stores/scoreboard';
import challongeIcoUrl from '../assets/challonge.ico';
import startggSvgUrl from '../assets/startgg.svg';
import { useQuasar } from 'quasar';

const props = defineProps<{
  side: 'left' | 'right';
}>();

const scoreboardStore = useScoreboardStore();
const player = usePlayerSide(props.side);
const $q = useQuasar();

const {
  leftCharacterOptions,
  rightCharacterOptions,
  leftCharacterInput,
  rightCharacterInput,
  onLeftCharacterFilter,
  onLeftCharacterFocus,
  onLeftCharacterBlur,
  onRightCharacterFilter,
  onRightCharacterFocus,
  onRightCharacterBlur,
} = inject(CHARACTER_GAME_KEY)!;

const isLeft = computed(() => props.side === 'left');

const characterOptions = computed(() =>
  isLeft.value ? leftCharacterOptions.value : rightCharacterOptions.value,
);

const characterInputValue = computed({
  get: () => (isLeft.value ? leftCharacterInput.value : rightCharacterInput.value),
  set: (v) => {
    if (isLeft.value) leftCharacterInput.value = v;
    else rightCharacterInput.value = v;
  },
});

const onCharacterFilter = computed(() =>
  isLeft.value ? onLeftCharacterFilter : onRightCharacterFilter,
);

const onCharacterFocus = computed(() =>
  isLeft.value ? onLeftCharacterFocus : onRightCharacterFocus,
);

const onCharacterBlur = computed(() =>
  isLeft.value ? onLeftCharacterBlur : onRightCharacterBlur,
);

const character = computed({
  get: () => (isLeft.value
    ? scoreboardStore.scoreboard.leftCharacter
    : scoreboardStore.scoreboard.rightCharacter),
  set: (v) => scoreboardStore.updateCharacter(props.side, v),
});

const sideLabel = computed(() => t(isLeft.value ? 'scoreboardLeft' : 'scoreboardRight'));

const score = computed(() =>
  isLeft.value
    ? scoreboardStore.scoreboard.leftScore
    : scoreboardStore.scoreboard.rightScore,
);

const adjustScore = (delta: number) => {
  if (isLeft.value) {
    if (delta > 0) scoreboardStore.incrementLeftScore();
    else scoreboardStore.decrementLeftScore();
  } else {
    if (delta > 0) scoreboardStore.incrementRightScore();
    else scoreboardStore.decrementRightScore();
  }
};

const handleNameSave = () => {
  player.onNameSave();
  $q.notify({ type: 'positive', message: t('scoreboardSavedLocally'), position: 'bottom', timeout: 1500 });
};

const handleTeamSave = () => {
  player.saveTeamChange();
  $q.notify({ type: 'positive', message: t('scoreboardSavedLocally'), position: 'bottom', timeout: 1500 });
};

const handleCountrySave = () => {
  player.saveCountryChange();
  $q.notify({ type: 'positive', message: t('scoreboardSavedLocally'), position: 'bottom', timeout: 1500 });
};
</script>

<template>
  <div class="player-panel">
    <div class="panel-header">
      {{ sideLabel }}
    </div>
    <div class="player-panel__controls">
      <QSelect
        v-model="player.playerId.value"
        v-model:input-value="player.inputValue.value"
        :options="player.playerOptions.value"
        :label="t('scoreboardLabelPlayer')"
        dense
        emit-value
        map-options
        use-input
        input-debounce="250"
        hide-selected
        fill-input
        options-dense
        color="primary"
        popup-content-class="glass-panel glass-dropdown"
        class="underlined-field"
        @filter="player.onFilter"
        @focus="player.onFocus"
        @blur="player.onBlur"
        @update:model-value="player.onSelect"
      >
        <template #prepend>
          <QIcon name="person" />
        </template>
        <template #before-options>
          <div class="text-caption text-grey-5 q-pa-sm text-center">
            {{ t('scoreboardPlayerHint') }}
          </div>
        </template>
        <template #append>
          <QBtn
            v-if="player.showsNameSave.value"
            flat
            round
            dense
            icon="save"
            color="primary"
            @click.stop="handleNameSave"
          >
            <QTooltip
              class="glass-tooltip"
              anchor="top middle"
              self="bottom middle"
              :offset="[0, 8]"
            >
              {{ t('tooltipSaveLocalOverride') }}
            </QTooltip>
          </QBtn>
        </template>
        <template #option="scope">
          <QItem v-bind="scope.itemProps">
            <QItemSection>
              <QItemLabel class="player-panel__player-option">
                {{ scope.opt.label }}
                <img
                  v-if="scope.opt.source === 'startgg'"
                  :src="startggSvgUrl"
                  alt="start.gg"
                  class="player-panel__source-icon"
                >
                <img
                  v-if="scope.opt.source === 'challonge'"
                  :src="challongeIcoUrl"
                  alt="Challonge"
                  class="player-panel__source-icon"
                >
              </QItemLabel>
            </QItemSection>
          </QItem>
        </template>
      </QSelect>

      <QInput
        v-model="player.teamOverride.value"
        :label="t('scoreboardLabelTeam')"
        :placeholder="t('scoreboardTeamHint')"
        dense
        debounce="300"
        class="underlined-field"
      >
        <template #prepend>
          <QIcon name="groups" />
        </template>
        <template #append>
          <QBtn
            v-if="player.teamChanged.value"
            flat
            round
            dense
            icon="save"
            color="primary"
            @click.stop="handleTeamSave"
          >
            <QTooltip
              class="glass-tooltip"
              anchor="top middle"
              self="bottom middle"
              :offset="[0, 8]"
            >
              {{ t('tooltipSaveLocalOverride') }}
            </QTooltip>
          </QBtn>
        </template>
      </QInput>

      <QSelect
        v-model="player.countryOverride.value"
        v-model:input-value="player.countryInput.value"
        :options="player.filteredCountryOptions.value"
        option-value="value"
        option-label="label"
        emit-value
        map-options
        use-input
        input-debounce="250"
        hide-selected
        fill-input
        :label="t('scoreboardLabelCountry')"
        dense
        options-dense
        color="primary"
        popup-content-class="glass-panel glass-dropdown"
        class="underlined-field"
        @filter="player.onCountryFilter"
        @focus="player.onCountryFocus"
        @blur="player.onCountryBlur"
      >
        <template #prepend>
          <QIcon name="flag" />
        </template>
        <template #before-options>
          <div class="text-caption text-grey-5 q-pa-sm text-center">
            {{ t('scoreboardCountryHint') }}
          </div>
        </template>
        <template #append>
          <QBtn
            v-if="player.countryChanged.value"
            flat
            round
            dense
            icon="save"
            color="primary"
            @click.stop="handleCountrySave"
          >
            <QTooltip
              class="glass-tooltip"
              anchor="top middle"
              self="bottom middle"
              :offset="[0, 8]"
            >
              {{ t('tooltipSaveLocalOverride') }}
            </QTooltip>
          </QBtn>
        </template>
      </QSelect>

      <QSelect
        v-model="character"
        v-model:input-value="characterInputValue"
        :options="characterOptions"
        option-value="value"
        option-label="label"
        emit-value
        map-options
        :label="t('scoreboardLabelCharacter')"
        dense
        options-dense
        use-input
        input-debounce="250"
        hide-selected
        fill-input
        color="primary"
        popup-content-class="glass-panel glass-dropdown"
        class="underlined-field player-panel__character-field"
        :disable="!scoreboardStore.scoreboard.game"
        @filter="onCharacterFilter"
        @focus="onCharacterFocus"
        @blur="onCharacterBlur"
      >
        <template #prepend>
          <QIcon name="sports_martial_arts" />
        </template>
        <template #before-options>
          <div class="text-caption text-grey-5 q-pa-sm text-center">
            {{ t('scoreboardCharacterHint') }}
          </div>
        </template>
        <template #option="scope">
          <QItem v-bind="scope.itemProps">
            <QItemSection>
              <QItemLabel class="player-panel__character-option">
                {{ scope.opt.label }}
                <span
                  v-if="scope.opt.dlc"
                  class="player-panel__dlc-badge"
                >DLC</span>
              </QItemLabel>
            </QItemSection>
          </QItem>
        </template>
      </QSelect>
    </div>

    <div class="player-panel__score-actions">
      <QBtn
        color="dark"
        text-color="white"
        outline
        class="score-action-btn decrease-btn"
        icon="remove"
        @click="adjustScore(-1)"
      >
        <QTooltip
          class="glass-tooltip"
          anchor="top middle"
          self="bottom middle"
          :offset="[0, 8]"
        >
          {{ t('tooltipDecreaseScore') }}
        </QTooltip>
      </QBtn>
      <div class="score-display">
        {{ score }}
      </div>
      <QBtn
        text-color="black"
        class="score-action-btn increase-btn"
        icon="add"
        @click="adjustScore(1)"
      >
        <QTooltip
          class="glass-tooltip"
          anchor="top middle"
          self="bottom middle"
          :offset="[0, 8]"
        >
          {{ t('tooltipIncreaseScore') }}
        </QTooltip>
      </QBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">

.player-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.player-panel__controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.player-panel__score-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
}

.score-action-btn {
  font-weight: 600;
  border-radius: 8px;
  width: 44px;
  height: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 0.1s ease, background-color 0.2s ease;
}

.score-action-btn:active {
  transform: scale(0.92);
}

.score-display {
  font-family: var(--font-mono);
  font-size: 2.2rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
  flex: 1;
  user-select: none;
}

.increase-btn {
  background: #f59e0b;
  color: #111;
}

.decrease-btn {
  border-color: rgba(255, 255, 255, 0.2);
}

.player-panel__character-field {
  margin-top: 4px;
}

.player-panel__character-option,
.player-panel__player-option {
  display: flex;
  align-items: center;
  gap: 6px;
}

.player-panel__source-icon {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.player-panel__dlc-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 14px;
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.45);
  flex-shrink: 0;
}

</style>
