<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useBracketStore } from '../stores/bracket';
import { useScoreboardStore } from '../stores/scoreboard';
import { usePlayerSide } from '../composables/usePlayerSide';
import { t } from '../i18n';

const bracketStore = useBracketStore();
const scoreboardStore = useScoreboardStore();
const $q = useQuasar();

const leftPlayer = usePlayerSide('left');
const rightPlayer = usePlayerSide('right');

const activeMatch = computed(() => {
  if (!bracketStore.activeMatchId) return null;
  return bracketStore.matches.find((m: import('../../../extension/util/types').BracketSet) => m.id === bracketStore.activeMatchId) || null;
});

const isConfirmReportOpen = ref(false);

const openReportConfirm = () => {
  isConfirmReportOpen.value = true;
};

const submitAutoReport = async () => {
  const match = activeMatch.value;
  if (!match) return;

  const leftScore = scoreboardStore.leftScore;
  const rightScore = scoreboardStore.rightScore;
  const leftName = leftPlayer.displayName.value || 'Left Player';
  const rightName = rightPlayer.displayName.value || 'Right Player';

  let p1IsLeft = true;
  if (match.player1 && match.player1.id === scoreboardStore.scoreboard.rightPlayerId) {
    p1IsLeft = false;
  } else if (match.player2 && match.player2.id === scoreboardStore.scoreboard.leftPlayerId) {
    p1IsLeft = false;
  } else if (match.player1 && scoreboardStore.scoreboard.rightNameOverride === match.player1.gamertag) {
    p1IsLeft = false;
  }

  let winnerId = '';
  if (leftScore > rightScore) {
    winnerId = p1IsLeft ? (match.player1?.id || '') : (match.player2?.id || '');
  } else if (rightScore > leftScore) {
    winnerId = p1IsLeft ? (match.player2?.id || '') : (match.player1?.id || '');
  } else {
    $q.notify({ type: 'negative', message: t('activeMatchTiesNotAllowed') });
    return;
  }

  const scoresCsv = p1IsLeft
    ? `${leftScore}-${rightScore}`
    : `${rightScore}-${leftScore}`;

  try {
    await bracketStore.reportMatch(winnerId, scoresCsv);
    $q.notify({ type: 'positive', message: t('activeMatchReportedResult').replace('{result}', `${leftName} ${leftScore} - ${rightScore} ${rightName}`) });
    bracketStore.activeMatchId = null; 
    isConfirmReportOpen.value = false;
  } catch {
    $q.notify({ type: 'negative', message: t('activeMatchReportError') });
  }
};

const stopCovering = () => {
  bracketStore.activeMatchId = null;
};
</script>

<template>
  <Transition name="slide-fade">
    <div
      v-if="activeMatch"
      class="q-mb-md"
    >
      <QCard class="active-match-card glass-panel text-center">
        <div class="q-py-sm q-px-md flex column items-center">
          <div 
            class="row items-center justify-center q-mb-xs" 
            style="width: 100%; position: relative;"
          >
            <div 
              class="text-caption text-grey-5 uppercase-tracking text-center" 
              style="line-height: 1;"
            >
              {{ activeMatch.fullRoundText }}
            </div>
          </div>
          
          <div 
            class="row items-center justify-center q-mb-sm text-subtitle1 text-weight-bold" 
            style="width: 100%;"
          >
            <div
              class="text-right ellipsis"
              style="flex: 1;"
            >
              {{ activeMatch.player1?.gamertag || 'TBD' }} 
            </div>
            <div class="text-primary q-px-sm">
              vs
            </div>
            <div
              class="text-left ellipsis"
              style="flex: 1;"
            >
              {{ activeMatch.player2?.gamertag || 'TBD' }}
            </div>
          </div>
          
          <div class="row items-center justify-center q-gutter-md">
            <QBtn
              flat
              color="grey-5"
              no-caps
              icon="close"
              :label="t('activeMatchStopCovering')"
              size="sm"
              @click="stopCovering"
            />
            <QBtn
              unelevated
              color="primary"
              no-caps
              icon="emoji_events"
              :label="t('activeMatchReportScore')"
              size="sm"
              style="padding: 2px 12px;"
              @click="openReportConfirm"
            />
          </div>
        </div>
      </QCard>

      <QDialog v-model="isConfirmReportOpen">
        <QCard
          class="glass-panel"
          style="min-width: 500px"
        >
          <QCardSection>
            <div class="text-h6 panel-header">
              {{ t('activeMatchConfirmReport') }}
            </div>
          </QCardSection>
          <QCardSection class="q-pt-none text-body1">
            {{ t('activeMatchConfirmReportQuestion') }}
            <div class="q-mt-md row items-center justify-center q-gutter-md text-h5 text-weight-bold">
              <div
                class="text-right ellipsis"
                style="flex:1"
              >
                {{ leftPlayer.displayName.value || t('activeMatchLeft') }}
              </div>
              <div class="text-primary">
                {{ scoreboardStore.leftScore }}
              </div>
              <div>-</div>
              <div class="text-primary">
                {{ scoreboardStore.rightScore }}
              </div>
              <div
                class="text-left ellipsis"
                style="flex:1"
              >
                {{ rightPlayer.displayName.value || t('activeMatchRight') }}
              </div>
            </div>
          </QCardSection>
          <QCardActions
            align="right"
            class="q-pa-sm"
            style="background: var(--bg-subtle)"
          >
            <QBtn
              v-close-popup
              outline
              color="grey-8"
              :label="t('playersBtnCancel')"
              no-caps
              class="subtle-action-btn"
            />
            <QBtn
              unelevated
              :label="t('bracketReportResult')"
              color="primary"
              no-caps
              class="primary-action-btn"
              @click="submitAutoReport"
            />
          </QCardActions>
        </QCard>
      </QDialog>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.active-match-card {
  border: 1px solid var(--q-positive) !important;
  box-shadow: 0 0 4px rgba(33, 186, 69, 0.4);
  animation: breathe-positive 3s infinite ease-in-out;
}

@keyframes breathe-positive {
  0% { box-shadow: 0 0 4px rgba(33, 186, 69, 0.4); }
  50% { box-shadow: 0 0 14px rgba(33, 186, 69, 0.9); }
  100% { box-shadow: 0 0 4px rgba(33, 186, 69, 0.4); }
}
</style>
