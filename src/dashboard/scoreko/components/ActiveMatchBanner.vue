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
    bracketStore.activeMatchId = null; 
    isConfirmReportOpen.value = false;
  } catch {
    // Error is handled and notified inside bracketStore.reportMatch
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
          <div class="row items-center justify-center q-mb-xs full-width relative-position">
            <div class="text-caption text-grey-5 uppercase-tracking text-center active-match-round">
              {{ activeMatch.fullRoundText }}
            </div>
          </div>
          
          <div class="row items-center justify-center q-mb-sm text-subtitle1 text-weight-bold full-width">
            <div class="text-right ellipsis col">
              {{ activeMatch.player1?.gamertag || 'TBD' }} 
            </div>
            <div class="text-primary q-px-sm">
              vs
            </div>
            <div class="text-left ellipsis col">
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
              class="report-btn"
              @click="openReportConfirm"
            />
          </div>
        </div>
      </QCard>

      <QDialog v-model="isConfirmReportOpen">
        <QCard class="glass-panel report-dialog-card">
          <QCardSection>
            <div class="text-h6 panel-header">
              {{ t('activeMatchConfirmReport') }}
            </div>
          </QCardSection>
          <QCardSection class="q-pt-none text-body1">
            {{ t('activeMatchConfirmReportQuestion') }}
            <div class="q-mt-md row items-center justify-center q-gutter-md text-h5 text-weight-bold">
              <div class="text-right ellipsis col">
                {{ leftPlayer.displayName.value || t('activeMatchLeft') }}
              </div>
              <div class="text-primary">
                {{ scoreboardStore.leftScore }}
              </div>
              <div>-</div>
              <div class="text-primary">
                {{ scoreboardStore.rightScore }}
              </div>
              <div class="text-left ellipsis col">
                {{ rightPlayer.displayName.value || t('activeMatchRight') }}
              </div>
            </div>
          </QCardSection>
          <QCardActions
            align="right"
            class="q-pa-sm dialog-actions"
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

.active-match-round {
  line-height: 1;
}

.report-btn {
  padding: 2px 12px;
}

.report-dialog-card {
  min-width: 500px;
}

.dialog-actions {
  background: var(--bg-subtle);
}
</style>
