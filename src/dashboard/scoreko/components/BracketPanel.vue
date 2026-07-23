<script setup lang="ts">
defineOptions({ name: 'BracketPanel' });
import { computed, onMounted, ref, watch } from 'vue';
import { useScoreboardStore } from '../stores/scoreboard';
import { t } from '../i18n';

const scoreboardStore = useScoreboardStore();

const stageOptionsList = [
  'Pools',
  'Round 1',
  'Round 2',
  'Round 3',
  'Round 4',
  'Round 5',
  'Round 6',
  'Quarter-Finals',
  'Quarter-Final',
  'Semi-Finals',
  'Semi-Final',
  'Final',
  'Grand Final',
  'Grand Final Reset',
];

const stageOptions = computed(() => [
  { label: t('bracketStagePools'), value: 'Pools' },
  { label: t('bracketStageRound1'), value: 'Round 1' },
  { label: t('bracketStageRound2'), value: 'Round 2' },
  { label: t('bracketStageRound3'), value: 'Round 3' },
  { label: t('bracketStageRound4'), value: 'Round 4' },
  { label: t('bracketStageRound5'), value: 'Round 5' },
  { label: t('bracketStageRound6'), value: 'Round 6' },
  { label: t('bracketStageQuarterFinals'), value: 'Quarter-Finals' },
  { label: t('bracketStageSemiFinals'), value: 'Semi-Finals' },
  { label: t('bracketStageFinal'), value: 'Final' },
  { label: t('bracketStageGrandFinal'), value: 'Grand Final' },
  { label: t('bracketStageGrandFinalReset'), value: 'Grand Final Reset' },
]);

const bracketSideOptions = computed(() => [
  { label: t('bracketSideNone'), value: '' },
  { label: t('bracketSideWinners'), value: 'Winners' },
  { label: t('bracketSideLosers'), value: 'Losers' },
]);

const stage = ref(stageOptionsList[0]);
const bracketSide = ref('');
const customText = ref(localStorage.getItem('bracketPanelCustomText') || '');
const hasChanges = ref(false);

const parseInitialRound = () => {
  const round = scoreboardStore.scoreboard.round.trim();
  if (!round) {
    return;
  }

  for (const option of bracketSideOptions.value) {
    if (!option.value) {
      continue;
    }
    const prefix = `${option.value} `;
    if (round.startsWith(prefix)) {
      const remainder = round.slice(prefix.length);
      if (stageOptionsList.includes(remainder)) {
        stage.value = remainder;
        bracketSide.value = option.value;
        customText.value = '';
        return;
      }
    }
  }

  if (stageOptionsList.includes(round)) {
    stage.value = round;
    bracketSide.value = '';
    customText.value = '';
    return;
  }

  customText.value = round;
};

const applyRound = () => {
  if (!hasChanges.value) {
    return;
  }
  if (customText.value.trim()) {
    scoreboardStore.updateRound(customText.value.trim());
    return;
  }

  const prefix = bracketSide.value ? `${bracketSide.value} ` : '';
  scoreboardStore.updateRound(`${prefix}${stage.value}`.trim());
};

watch([stage, bracketSide, customText], applyRound);

watch(customText, (value) => {
  localStorage.setItem('bracketPanelCustomText', value);
});

const localRound = computed(() => {
  if (customText.value.trim()) {
    return customText.value.trim();
  }
  const prefix = bracketSide.value ? `${bracketSide.value} ` : '';
  return `${prefix}${stage.value}`.trim();
});

watch(
  () => scoreboardStore.scoreboard.round,
  (newRound) => {
    if (newRound.trim() !== localRound.value) {
      parseInitialRound();
    }
  }
);

onMounted(() => {
  parseInitialRound();
  hasChanges.value = true;
});

const isFinalsPhase = computed(() => {
  const round = scoreboardStore.scoreboard.round.toLowerCase();
  return round.includes('final');
});
</script>

<template>
  <div class="bracket-panel">
    <div
      class="bracket-panel__grid"
      :class="{ 'gf-active': isFinalsPhase }"
    >
      <QSelect
        v-model="bracketSide"
        :options="bracketSideOptions"
        dense
        options-dense
        outlined
        emit-value
        map-options
        :placeholder="t('bracketSidePlaceholder')"
        color="primary"
        popup-content-class="glass-panel glass-dropdown"
        class="dark-input"
        @update:model-value="customText = ''"
      />
      <QSelect
        v-model="stage"
        :options="stageOptions"
        dense
        options-dense
        outlined
        emit-value
        map-options
        option-value="value"
        option-label="label"
        :placeholder="t('bracketStagePlaceholder')"
        color="primary"
        popup-content-class="glass-panel glass-dropdown"
        class="dark-input"
        @update:model-value="customText = ''"
      />
      <QBtnGroup
        v-if="isFinalsPhase"
        unelevated
        class="gf-advantage-group"
      >
        <QBtn
          unelevated
          size="sm"
          :color="scoreboardStore.scoreboard.leftBracketStatus === 'W' ? 'primary' : ''"
          :class="['gf-advantage-btn', { 'is-active': scoreboardStore.scoreboard.leftBracketStatus === 'W' }]"
          text-color="red"
          icon="person"
          @click="scoreboardStore.setGrandFinalsAdvantage('left')"
        />
        <QBtn
          unelevated
          size="sm"
          :color="scoreboardStore.scoreboard.rightBracketStatus === 'W' ? 'primary' : ''"
          :class="['gf-advantage-btn', { 'is-active': scoreboardStore.scoreboard.rightBracketStatus === 'W' }]"
          text-color="blue"
          icon="person"
          @click="scoreboardStore.setGrandFinalsAdvantage('right')"
        />
      </QBtnGroup>
    </div>

    <div class="bracket-panel__custom">
      <QInput
        v-model="customText"
        :placeholder="t('bracketCustomPlaceholder')"
        dense
        outlined
        debounce="300"
        class="dark-input custom-input"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">

.bracket-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  height: 100%;
}

.bracket-panel__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  transition: grid-template-columns 0.3s ease;
}

.bracket-panel__grid.gf-active {
  grid-template-columns: 1fr 1fr auto;
}

.bracket-panel__custom {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-input {
  flex: 1;
}

.gf-advantage-group {
  border-radius: 6px;
  border: 1px solid var(--border-medium);
  overflow: hidden;
  height: 40px; 
}

.gf-advantage-btn {
  font-family: var(--font-mono);
  font-weight: bold;
  padding: 0 8px;
}

.gf-advantage-btn:not(.is-active) {
  background: var(--bg-subtle) !important;
}

.gf-advantage-btn + .gf-advantage-btn {
  border-left: 1px solid var(--border-medium);
}
</style>