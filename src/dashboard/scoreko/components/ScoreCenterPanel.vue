<script setup lang="ts">
defineOptions({ name: 'ScoreCenterPanel' });
import { computed, inject, onMounted, ref } from 'vue';
import { CHARACTER_GAME_KEY } from '../composables/useCharacterGame';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useNotify } from '../composables/useNotify';
import { t } from '../i18n';
import { usePacksStore } from '../stores/packs';
import { useScoreboardStore } from '../stores/scoreboard';

const isSwapping = ref(false);

const scoreboardStore = useScoreboardStore();
const packRegistry = usePacksStore();
const { confirmAction } = useConfirmDialog();
const { notifyInfo } = useNotify();

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
  isSwapping.value = true;
  scoreboardStore.swapPlayers();
  notifyInfo(t('scoreboardPlayersSwapped'));
  setTimeout(() => {
    isSwapping.value = false;
  }, 250);
};

const handleClear = async () => {
  const confirmed = await confirmAction({
    title: t('scoreboardClear'),
    message: t('scoreboardClearConfirm'),
    destructive: true
  });
  if (!confirmed) return;

  scoreboardStore.clearAll();
  notifyInfo(t('scoreboardCleared'));
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
        class="underlined-field"
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
          @click="handleSwap"
        >
          <QIcon
            name="swap_horiz"
            class="icon-spin-180 q-mr-xs"
            :class="{ 'is-spinning': isSwapping }"
          />
          {{ t('scoreboardSwap') }}
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
