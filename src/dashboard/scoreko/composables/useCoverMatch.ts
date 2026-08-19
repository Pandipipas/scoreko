import { ref, computed, type Ref } from 'vue';
import { useQuasar } from 'quasar';
import type { BracketSet } from '../../../extension/util/types';
import { useBracketStore } from '../stores/bracket';
import { usePlayersStore } from '../stores/players';
import { useScoreboardStore } from '../stores/scoreboard';
import { t } from '../i18n';
import { CUSTOM_LEFT_PLAYER_ID, CUSTOM_RIGHT_PLAYER_ID } from './usePlayerSide';

export function useCoverMatch(matchRef: Ref<BracketSet>) {
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
      p1Score: mapScoreForReport(matchRef.value?.player1?.score),
      p2Score: mapScoreForReport(matchRef.value?.player2?.score),
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
    
    if (p2 === 'DQ') return matchRef.value.player1?.id;
    if (p1 === 'DQ') return matchRef.value.player2?.id;
    
    if (typeof p1 === 'number' && typeof p2 === 'number') {
      if (p1 > p2) return matchRef.value.player1?.id;
      if (p2 > p1) return matchRef.value.player2?.id;
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
      bracketStore.activeMatchId = matchRef.value.id;
      await bracketStore.reportMatch(winnerId, scoresCsv);
      closeFn();
    } catch {
      // Error is handled and notified inside bracketStore.reportMatch
    } finally {
      if (bracketStore.activeMatchId === matchRef.value.id) {
        bracketStore.activeMatchId = oldActive === matchRef.value.id ? null : oldActive;
      }
    }
  };

  const coverMatch = () => {
    if (bracketStore.activeMatchId === matchRef.value.id) {
      bracketStore.activeMatchId = null;
      $q.notify({ type: 'info', message: t('bracketMatchUncovered') });
      return;
    }

    bracketStore.activeMatchId = matchRef.value.id;
    const match = matchRef.value;

    const players = playersStore.players;
    const newScoreboard = { ...scoreboardStore.scoreboard };
    
    if (match.player1) {
      if (players[match.player1.id]) {
        newScoreboard.leftPlayerId = match.player1.id;
        newScoreboard.leftNameOverride = '';
        newScoreboard.leftTeamOverride = '';
        newScoreboard.leftCountryOverride = '';
      } else {
        newScoreboard.leftPlayerId = CUSTOM_LEFT_PLAYER_ID;
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
        newScoreboard.rightPlayerId = CUSTOM_RIGHT_PLAYER_ID;
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

  return {
    reportData,
    openGridReport,
    setGridScore,
    derivedGridWinnerId,
    submitGridReport,
    coverMatch
  };
}
