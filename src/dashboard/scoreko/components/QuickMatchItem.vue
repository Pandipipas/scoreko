<script setup lang="ts">
import { computed } from 'vue';
import type { BracketSet } from '../../../extension/util/types';
import { useBracketStore } from '../stores/bracket';
import { t } from '../i18n';
import { useCoverMatch } from '../composables/useCoverMatch';

const props = defineProps<{
  match: BracketSet;
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
  <QItem
    clickable
    class="val-match-item hover-shift-right"
    :active="bracketStore.activeMatchId === match.id"
    active-class="selected-match-item"
    @click="coverMatch"
  >
    <QItemSection class="min-w-0">
      <QItemLabel class="text-white text-weight-medium ellipsis match-title">
        <span class="gamertag-text">{{ match.player1?.gamertag || 'TBD' }}</span>
        <span class="text-primary text-weight-bold q-mx-sm match-vs">{{ t('quickMatchVs') }}</span>
        <span class="gamertag-text">{{ match.player2?.gamertag || 'TBD' }}</span>
      </QItemLabel>
      <QItemLabel
        caption
        class="text-grey-5 ellipsis"
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
                  <div class="text-subtitle2 report-title">
                    {{ t('bracketReportResult') }}
                  </div>
                </div>
                
                
                <div class="row items-center q-mb-sm report-score-row no-wrap">
                  <div class="col-5 ellipsis text-weight-medium q-pr-xs player-name-col">
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
                  <div class="col-5 ellipsis text-weight-medium q-pr-xs player-name-col">
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
                class="q-px-sm q-pb-sm dialog-actions"
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
  transition: background-color 0.2s ease, padding-left 0.2s ease;
  border-left: 3px solid transparent;
  padding: 8px 16px;
  overflow: hidden;
  max-width: 100%;
  box-sizing: border-box;
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
.min-w-0 {
  min-width: 0;
}
.match-title {
  font-size: 0.95rem;
}
.match-vs {
  font-size: 0.8rem;
  opacity: 0.8;
}
.report-title {
  font-size: 0.85rem;
  line-height: 1;
}
.player-name-col {
  font-size: 0.75rem;
}
.dialog-actions {
  background: var(--bg-subtle);
}
</style>
