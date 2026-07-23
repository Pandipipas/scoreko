<script setup lang="ts">
import { useQuasar } from 'quasar';
import { ref, computed } from 'vue';
import type { BracketSet } from '../../../extension/util/types';
import { useBracketStore } from '../stores/bracket';
import { usePlayersStore } from '../stores/players';
import { useScoreboardStore } from '../stores/scoreboard';
import { t } from '../i18n';

const props = defineProps<{
  match: BracketSet;
  variant?: 'grid' | 'bracket';
}>();

const bracketStore = useBracketStore();
const playersStore = usePlayersStore();
const scoreboardStore = useScoreboardStore();
const $q = useQuasar();

const reportData = ref<{
  p1Score: number | 'DQ' | null;
  p2Score: number | 'DQ' | null;
}>({
  p1Score: null,
  p2Score: null,
});

const mapScoreForReport = (score: number | string | null | undefined): number | 'DQ' | null => {
  if (score === null || score === undefined || score === '') return null;
  if (score === 'DQ') return 'DQ';
  const num = typeof score === 'string' ? parseInt(score, 10) : score;
  if (isNaN(num)) return null;
  if (num === -1) return 'DQ';
  return num;
};

const openGridReport = () => {
  reportData.value = {
    p1Score: mapScoreForReport(props.match?.player1?.score),
    p2Score: mapScoreForReport(props.match?.player2?.score),
  };
};

const setGridScore = (playerIndex: 1 | 2, score: number | 'DQ') => {
  if (playerIndex === 1) {
    reportData.value.p1Score = score;
  } else {
    reportData.value.p2Score = score;
  }
};

const derivedGridWinnerId = computed(() => {
  const p1 = reportData.value.p1Score;
  const p2 = reportData.value.p2Score;
  
  if (p2 === 'DQ') return props.match.player1?.id;
  if (p1 === 'DQ') return props.match.player2?.id;
  
  if (typeof p1 === 'number' && typeof p2 === 'number') {
    if (p1 > p2) return props.match.player1?.id;
    if (p2 > p1) return props.match.player2?.id;
  }
  
  return null;
});

const submitGridReport = async (closeFn: () => void) => {
  const winnerId = derivedGridWinnerId.value;
  if (!winnerId) {
    $q.notify({ type: 'warning', message: t('bracketWinnerUndetermined') });
    return;
  }

  let scoresCsv = '';
  const p1 = reportData.value.p1Score;
  const p2 = reportData.value.p2Score;
  
  if (p1 === 'DQ' || p2 === 'DQ') {
    if (bracketStore.provider === 'challonge') {
      const p1Str = p1 === 'DQ' ? '-1' : '0';
      const p2Str = p2 === 'DQ' ? '-1' : '0';
      scoresCsv = `${p1Str}-${p2Str}`;
    } else {
      scoresCsv = '0-0';
    }
  } else if (typeof p1 === 'number' && typeof p2 === 'number') {
    scoresCsv = `${p1}-${p2}`;
  }

  const oldActive = bracketStore.activeMatchId;
  try {
    bracketStore.activeMatchId = props.match.id;
    await bracketStore.reportMatch(winnerId, scoresCsv);
    $q.notify({ type: 'positive', message: t('bracketReportSuccess') });
    closeFn();
  } catch {
    $q.notify({ type: 'negative', message: t('bracketReportFailed') });
  } finally {
    if (bracketStore.activeMatchId === props.match.id) {
      bracketStore.activeMatchId = oldActive === props.match.id ? null : oldActive;
    }
  }
};

const coverMatch = () => {
  if (bracketStore.activeMatchId === props.match.id) {
    bracketStore.activeMatchId = null;
    $q.notify({ type: 'info', message: t('bracketMatchUncovered') });
    return;
  }

  bracketStore.activeMatchId = props.match.id;
  const match = props.match;

  const players = playersStore.players;
  const newScoreboard = { ...scoreboardStore.scoreboard };
  
  if (match.player1) {
    if (players[match.player1.id]) {
      newScoreboard.leftPlayerId = match.player1.id;
      newScoreboard.leftNameOverride = '';
      newScoreboard.leftTeamOverride = '';
      newScoreboard.leftCountryOverride = '';
    } else {
      newScoreboard.leftPlayerId = '__custom_left_player__';
      newScoreboard.leftNameOverride = match.player1.gamertag;
      newScoreboard.leftTeamOverride = match.player1.team ?? '';
      newScoreboard.leftCountryOverride = '';
    }
    newScoreboard.leftScore = 0;
  }
  
  if (match.player2) {
    if (players[match.player2.id]) {
      newScoreboard.rightPlayerId = match.player2.id;
      newScoreboard.rightNameOverride = '';
      newScoreboard.rightTeamOverride = '';
      newScoreboard.rightCountryOverride = '';
    } else {
      newScoreboard.rightPlayerId = '__custom_right_player__';
      newScoreboard.rightNameOverride = match.player2.gamertag;
      newScoreboard.rightTeamOverride = match.player2.team ?? '';
      newScoreboard.rightCountryOverride = '';
    }
    newScoreboard.rightScore = 0;
  }
  if (match.fullRoundText === 'Grand Final') {
    const matches = bracketStore.matches;
    const wfMatch = matches.find((m: BracketSet) => m.fullRoundText === 'Winners Final');
    const lfMatch = matches.find((m: BracketSet) => m.fullRoundText === 'Losers Final');
    
    let p1Status = '';
    let p2Status = '';
    
    if (wfMatch?.winnerId) {
      if (match.player1?.id === wfMatch.winnerId) p1Status = 'W';
      else if (match.player2?.id === wfMatch.winnerId) p2Status = 'W';
    }
    if (lfMatch?.winnerId) {
      if (match.player1?.id === lfMatch.winnerId) p1Status = 'L';
      else if (match.player2?.id === lfMatch.winnerId) p2Status = 'L';
    }
    
    if (p1Status === 'W' && !p2Status) p2Status = 'L';
    else if (p2Status === 'W' && !p1Status) p1Status = 'L';
    else if (p1Status === 'L' && !p2Status) p2Status = 'W';
    else if (p2Status === 'L' && !p1Status) p1Status = 'W';
    else if (!p1Status && !p2Status) {
      p1Status = 'W';
      p2Status = 'L';
    }
    
    newScoreboard.leftBracketStatus = p1Status;
    newScoreboard.rightBracketStatus = p2Status;
  } else {
    newScoreboard.leftBracketStatus = '';
    newScoreboard.rightBracketStatus = '';
  }

  newScoreboard.round = match.fullRoundText;
  scoreboardStore.setScoreboard(newScoreboard);
  
  $q.notify({ type: 'positive', message: t('bracketMatchCovered') });
};
</script>

<template>
  <QCard 
    class="match-grid-card glass-panel" 
    :class="{ 'bracket-variant': variant === 'bracket', 'active-match-border': variant !== 'bracket' && bracketStore.activeMatchId === match.id }" 
    :flat="variant === 'bracket'" 
    :bordered="variant === 'bracket' || bracketStore.activeMatchId === match.id"
  >
    <div
      v-if="variant !== 'bracket'"
      class="match-card-top-border"
    />
    
    <QCardSection
      v-if="variant !== 'bracket'"
      class="q-py-sm"
    >
      <div class="text-caption text-grey-6">
        {{ match.fullRoundText }}
      </div>
    </QCardSection>

    <QCardSection
      :class="variant === 'bracket' ? 'q-pa-xs' : 'q-pt-none q-pb-sm'"
      class="relative-position"
    >
      <div
        class="match-players-box"
        :class="{ 'active-match-border': variant === 'bracket' && bracketStore.activeMatchId === match.id }"
      >
        <div
          class="row items-center justify-between player-row q-px-sm q-py-xs no-wrap"
          :class="{ 'text-weight-bold': match.winnerId === match.player1?.id }"
        >
          <div class="gamertag-text ellipsis">
            {{ match.player1?.gamertag || 'TBD' }}
          </div>
          <div 
            v-if="match.state === 'completed' && match.player1?.score != null" 
            class="score-text q-px-sm rounded-borders text-white"
            :class="match.winnerId === match.player1?.id ? 'bg-positive' : 'bg-accent'"
            style="min-width: 28px; text-align: center; line-height: 1.5;"
          >
            {{ match.player1.score === -1 ? 'DQ' : match.player1.score }}
          </div>
        </div>
        <QSeparator />
        <div
          class="row items-center justify-between player-row q-px-sm q-py-xs no-wrap"
          :class="{ 'text-weight-bold': match.winnerId === match.player2?.id }"
        >
          <div class="gamertag-text ellipsis">
            {{ match.player2?.gamertag || 'TBD' }}
          </div>
          <div 
            v-if="match.state === 'completed' && match.player2?.score != null" 
            class="score-text q-px-sm rounded-borders text-white"
            :class="match.winnerId === match.player2?.id ? 'bg-positive' : 'bg-accent'"
            style="min-width: 28px; text-align: center; line-height: 1.5;"
          >
            {{ match.player2.score === -1 ? 'DQ' : match.player2.score }}
          </div>
        </div>
      </div>
    </QCardSection>

    <QCardSection
      v-if="variant !== 'bracket'"
      class="q-py-sm bg-subtle text-center"
    >
      <div class="text-caption text-primary text-weight-medium">
        {{ match.state === 'completed' ? t('bracketStateCompleted') : (match.state === 'in_progress' ? t('bracketStateInProgress') : t('bracketStateUpcoming')) }}
      </div>
    </QCardSection>

    <div class="action-overlay absolute-full row items-center justify-center q-gutter-x-sm q-px-sm">
      <QBtn
        class="glass-panel"
        color="primary"
        text-color="primary"
        outline
        round
        icon="edit"
      >
        <QTooltip class="glass-tooltip">
          {{ t('bracketEditMatch') }}
        </QTooltip>
        <QMenu 
          fit 
          anchor="top left" 
          self="top left" 
          @before-show="openGridReport"
        >
          <QCard class="report-popup-card glass-panel">
            <QCardSection class="q-pb-none">
              <div class="row items-center justify-between q-mb-sm">
                <div
                  class="text-subtitle2"
                  style="font-size: 0.85rem; line-height: 1"
                >
                  {{ t('bracketReportResult') }}
                </div>
              </div>
              
              
              <div class="row items-center q-mb-sm report-score-row no-wrap">
                <div
                  class="col-5 ellipsis text-weight-medium q-pr-xs"
                  style="font-size: 0.75rem"
                >
                  {{ match.player1?.gamertag || 'P1' }}
                </div>
                <div class="col-7 row justify-end q-gutter-x-xs no-wrap">
                  <QBtn
                    v-for="s in ['DQ', 0, 1, 2, 3]"
                    :key="`p1-${s}`"
                    :outline="reportData.p1Score !== s"
                    :unelevated="reportData.p1Score === s"
                    :color="reportData.p1Score === s ? 'primary' : 'grey-8'"
                    dense
                    class="score-btn"
                    @click="setGridScore(1, s as number | 'DQ')"
                  >
                    {{ s }}
                  </QBtn>
                </div>
              </div>
              
              
              <div class="row items-center q-mb-md report-score-row no-wrap">
                <div
                  class="col-5 ellipsis text-weight-medium q-pr-xs"
                  style="font-size: 0.75rem"
                >
                  {{ match.player2?.gamertag || 'P2' }}
                </div>
                <div class="col-7 row justify-end q-gutter-x-xs no-wrap">
                  <QBtn
                    v-for="s in ['DQ', 0, 1, 2, 3]"
                    :key="`p2-${s}`"
                    :outline="reportData.p2Score !== s"
                    :unelevated="reportData.p2Score === s"
                    :color="reportData.p2Score === s ? 'primary' : 'grey-8'"
                    dense
                    class="score-btn"
                    @click="setGridScore(2, s as number | 'DQ')"
                  >
                    {{ s }}
                  </QBtn>
                </div>
              </div>
            </QCardSection>
            
            <QCardActions
              align="right"
              class="q-px-sm q-pb-sm"
              style="background: var(--bg-subtle)"
            >
              <QBtn
                v-close-popup
                outline
                color="grey-8"
                :label="t('settingsManualCancel')"
                no-caps
                size="sm"
                class="q-mr-xs"
              />
              <QBtn 
                unelevated 
                color="primary" 
                :label="t('bracketSubmit')" 
                no-caps
                size="sm"
                :disable="!derivedGridWinnerId"
                @click="(e) => submitGridReport(() => { (e.target as HTMLElement)?.closest('.q-menu')?.remove() })" 
              />
            </QCardActions>
          </QCard>
        </QMenu>
      </QBtn>

      <QBtn
        v-if="match.state !== 'completed' || bracketStore.activeMatchId === match.id"
        class="glass-panel"
        :color="bracketStore.activeMatchId === match.id ? 'negative' : 'primary'"
        :text-color="bracketStore.activeMatchId === match.id ? 'negative' : 'primary'"
        outline
        round
        :icon="bracketStore.activeMatchId === match.id ? 'close' : 'videocam'"
        @click.stop="coverMatch"
      >
        <QTooltip class="glass-tooltip">
          {{ bracketStore.activeMatchId === match.id ? t('bracketUncover') : t('bracketCover') }}
        </QTooltip>
      </QBtn>
    </div>
  </QCard>
</template>

<style scoped lang="scss">
.match-grid-card {
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
  height: 100%;
}
.match-grid-card.bracket-variant {
  height: auto;
  border: none;
  background: transparent;
  box-shadow: none;
}
.match-grid-card.bracket-variant .match-players-box {
  background-color: var(--q-dark);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.body--light .match-grid-card.bracket-variant .match-players-box {
  background-color: white;
  box-shadow: 0 1px 5px rgba(0,0,0,0.1);
}
.match-grid-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.match-card-top-border {
  height: 4px;
  width: 100%;
  background-color: var(--q-primary);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}
.match-players-box {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.03);
}
.body--light .match-players-box {
  border-color: rgba(0, 0, 0, 0.1);
  background-color: white;
}
.player-row {
  min-height: 32px;
}
.gamertag-text {
  max-width: 130px;
}
.score-text {
  font-weight: bold;
}
.active-match-border {
  border: 1px solid var(--q-positive) !important;
  box-shadow: 0 0 4px rgba(33, 186, 69, 0.4);
  z-index: 1;
  animation: breathe-positive 3s infinite ease-in-out;
}

@keyframes breathe-positive {
  0% {
    box-shadow: 0 0 4px rgba(33, 186, 69, 0.4);
  }
  50% {
    box-shadow: 0 0 14px rgba(33, 186, 69, 0.9);
  }
  100% {
    box-shadow: 0 0 4px rgba(33, 186, 69, 0.4);
  }
}
.action-overlay {
  background: rgba(0, 0, 0, 0.7);
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 4px;
}
.body--light .action-overlay {
  background: rgba(255, 255, 255, 0.85);
}
.match-grid-card:hover .action-overlay {
  opacity: 1;
}
.report-popup-card {
  
  border-top: 4px solid var(--q-primary);
  overflow: hidden;
}
.score-btn {
  min-width: 20px;
  padding: 0 4px;
  font-size: 11px;
}
</style>
