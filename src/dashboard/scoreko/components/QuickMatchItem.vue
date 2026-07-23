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
  <QItem
    clickable
    class="val-match-item"
    :active="bracketStore.activeMatchId === match.id"
    active-class="selected-match-item"
    @click="coverMatch"
  >
    <QItemSection>
      <QItemLabel
        class="text-white text-weight-medium"
        style="font-size: 0.95rem"
      >
        <span class="gamertag-text">{{ match.player1?.gamertag || 'TBD' }}</span>
        <span
          class="text-primary text-weight-bold q-mx-sm"
          style="font-size: 0.8rem; opacity: 0.8"
        >{{ t('quickMatchVs') }}</span>
        <span class="gamertag-text">{{ match.player2?.gamertag || 'TBD' }}</span>
      </QItemLabel>
      <QItemLabel
        caption
        class="text-grey-5"
      >
        {{ match.fullRoundText }} • {{ match.state === 'in_progress' ? t('bracketStateInProgress') : t('bracketStateUpcoming') }}
      </QItemLabel>
    </QItemSection>

    <QItemSection side>
      <div class="row items-center q-gutter-x-xs no-wrap">
        <QBtn
          flat
          round
          dense
          color="primary"
          icon="edit"
          @click.stop
        >
          <QMenu 
            fit 
            anchor="top right" 
            self="top right" 
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
                  class="q-mr-xs subtle-action-btn"
                />
                <QBtn 
                  unelevated 
                  color="primary" 
                  :label="t('bracketSubmit')" 
                  no-caps
                  size="sm"
                  class="primary-action-btn"
                  :disable="!derivedGridWinnerId"
                  @click="(e) => submitGridReport(() => { (e.target as HTMLElement)?.closest('.q-menu')?.remove() })" 
                />
              </QCardActions>
            </QCard>
          </QMenu>
        </QBtn>

        <QBtn
          flat
          round
          dense
          :color="bracketStore.activeMatchId === match.id ? 'negative' : 'primary'"
          :icon="bracketStore.activeMatchId === match.id ? 'close' : 'videocam'"
          @click.stop="coverMatch"
        >
          <QTooltip>{{ bracketStore.activeMatchId === match.id ? t('bracketUncover') : t('bracketCover') }}</QTooltip>
        </QBtn>
      </div>
    </QItemSection>
  </QItem>
</template>

<style scoped lang="scss">

.val-match-item {
  transition: background-color 0.2s ease;
  border-left: 3px solid transparent;
  padding: 8px 16px;
}

.val-match-item:hover {
  background-color: var(--bg-subtle);
}

.selected-match-item {
  background-color: var(--bg-subtle);
  border-left: 3px solid var(--q-primary);
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
