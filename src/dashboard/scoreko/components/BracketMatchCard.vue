<script setup lang="ts">
import { computed } from 'vue';
import type { BracketSet } from '../../../extension/util/types';
import { useBracketStore } from '../stores/bracket';
import { t } from '../i18n';
import { useCoverMatch } from '../composables/useCoverMatch';

const props = defineProps<{
  match: BracketSet;
  variant?: 'grid' | 'bracket';
}>();

const bracketStore = useBracketStore();

const matchRef = computed(() => props.match);
const {
  reportData,
  openGridReport,
  setGridScore,
  derivedGridWinnerId,
  submitGridReport,
  coverMatch
} = useCoverMatch(matchRef);
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
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background-color: var(--bg-subtle);
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
.action-overlay {
  background: rgba(0, 0, 0, 0.7);
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 4px;
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
