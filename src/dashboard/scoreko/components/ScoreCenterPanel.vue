<script setup lang="ts">
defineOptions({ name: 'ScoreCenterPanel' });
import { computed, inject, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { CHARACTER_GAME_KEY } from '../composables/useCharacterGame';
import { usePacksStore } from '../stores/packs';
import { t } from '../i18n';
import { useScoreboardStore } from '../stores/scoreboard';

const $q = useQuasar();
const scoreboardStore = useScoreboardStore();
const packRegistry = usePacksStore();

const {
  gameInput,
  fightingGameOptions,
  onGameFilter,
  onGameFocus,
  onGameBlur,
  handleGameSelect,
} = inject(CHARACTER_GAME_KEY)!;

onMounted(() => {
  packRegistry.fetchRegistry();
});

const isAnythingFilled = computed(() => {
  const sb = scoreboardStore.scoreboard;
  return !!(
    sb.game ||
    sb.leftCharacter ||
    sb.rightCharacter ||
    sb.leftScore ||
    sb.rightScore ||
    sb.leftPlayerId ||
    sb.rightPlayerId ||
    sb.leftNameOverride ||
    sb.rightNameOverride ||
    sb.leftTeamOverride ||
    sb.rightTeamOverride ||
    sb.leftCountryOverride ||
    sb.rightCountryOverride
  );
});

const handleSwap = () => {
  scoreboardStore.swapPlayers();
  $q.notify({ type: 'info', message: t('scoreboardPlayersSwapped'), position: 'bottom', timeout: 1500 });
};

const handleClear = () => {
  scoreboardStore.clearAll();
  $q.notify({ type: 'info', message: t('scoreboardCleared'), position: 'bottom', timeout: 1500 });
};
</script>

<template>
  <div class="center-panel">
    <div class="panel-header">
      {{ t('scoreboardGameSelector') }}
    </div>
    
    <div class="center-panel__controls">
      <QSelect
        v-model:input-value="gameInput"
        :model-value="scoreboardStore.scoreboard.game"
        :options="fightingGameOptions"
        :label="t('scoreboardLabelGame')"
        dense
        options-dense
        emit-value
        map-options
        use-input
        input-debounce="0"
        hide-selected
        fill-input
        color="primary"
        popup-content-class="glass-panel glass-dropdown"
        class="underlined-field center-panel__game-field"
        @filter="onGameFilter"
        @focus="onGameFocus"
        @blur="onGameBlur"
        @update:model-value="handleGameSelect"
      >
        <template #prepend>
          <QIcon name="sports_esports" />
        </template>
        <template #before-options>
          <div class="text-caption text-grey-5 q-pa-sm text-center">
            {{ t('scoreboardGameHint') }}
          </div>
        </template>
      </QSelect>

      <div class="center-panel__actions">
        <QBtn
          outline
          color="white"
          class="full-width subtle-action-btn"
          icon="swap_horiz"
          :label="t('scoreboardSwap')"
          @click="handleSwap"
        >
          <QTooltip
            class="glass-tooltip"
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 8]"
          >
            {{ t('tooltipSwapPlayers') }}
          </QTooltip>
        </QBtn>
        <QBtn
          outline
          color="white"
          class="full-width subtle-action-btn"
          icon="clear_all"
          :label="t('scoreboardClear')"
          :disable="!isAnythingFilled"
          @click="handleClear"
        >
          <QTooltip
            class="glass-tooltip"
            anchor="top middle"
            self="bottom middle"
            :offset="[0, 8]"
          >
            {{ t('tooltipClearScoreboard') }}
          </QTooltip>
        </QBtn>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

.center-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.center-panel__controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.center-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

</style>
