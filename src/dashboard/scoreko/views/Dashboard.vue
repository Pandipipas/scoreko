<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { provide } from 'vue';
import { useCharacterGame, CHARACTER_GAME_KEY } from '../composables/useCharacterGame';
import ScoreboardBanner from '../components/ScoreboardBanner.vue';
import ActiveMatchBanner from '../components/ActiveMatchBanner.vue';
import BracketPanel from '../components/BracketPanel.vue';
import CommentaryPanel from '../components/CommentaryPanel.vue';
import PlayerSidePanel from '../components/PlayerSidePanel.vue';
import ScoreCenterPanel from '../components/ScoreCenterPanel.vue';
import QuickMatchesPanel from '../components/QuickMatchesPanel.vue';

defineOptions({ name: 'DashboardView' });

useHead({ title: 'Dashboard' });

const characterGame = useCharacterGame();
provide(CHARACTER_GAME_KEY, characterGame);
</script>

<template>
  <QPage class="q-px-lg q-pb-lg dashboard-page">
    <div class="dashboard-grid">
      <div class="dashboard-banner-row">
        <ScoreboardBanner />
      </div>
      
      <div class="dashboard-controls-row">
        <QCard class="dashboard-panel-card glass-panel">
          <QCardSection class="dashboard-panel-content">
            <PlayerSidePanel side="left" />
          </QCardSection>
        </QCard>
        
        <div class="dashboard-center-column">
          <ActiveMatchBanner />
          <QCard
            class="dashboard-panel-card glass-panel"
            style="flex: 1; height: auto;"
          >
            <QCardSection class="dashboard-panel-content">
              <ScoreCenterPanel />
            </QCardSection>
          </QCard>
        </div>
        
        <QCard class="dashboard-panel-card glass-panel">
          <QCardSection class="dashboard-panel-content">
            <PlayerSidePanel side="right" />
          </QCardSection>
        </QCard>
      </div>

      <div class="dashboard-bottom-row">
        <QCard class="dashboard-panel-card glass-panel">
          <QCardSection class="dashboard-panel-content">
            <CommentaryPanel />
          </QCardSection>
        </QCard>
        
        <QCard class="dashboard-panel-card glass-panel">
          <QCardSection class="dashboard-panel-content">
            <BracketPanel />
          </QCardSection>
        </QCard>

        <QCard class="dashboard-panel-card glass-panel">
          <QCardSection class="dashboard-panel-content">
            <QuickMatchesPanel />
          </QCardSection>
        </QCard>
      </div>
    </div>
  </QPage>
</template>

<style scoped lang="scss">

.dashboard-page {
  padding-top: 32px;
}

.dashboard-grid {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 24px);
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
}

.dashboard-banner-row {
  width: 100%;
}

.dashboard-controls-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(16px, 2vw, 24px);
}

.dashboard-bottom-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(16px, 2vw, 24px);
}

.dashboard-panel-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dashboard-center-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dashboard-panel-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

@media (max-width: 1200px) {
  .dashboard-controls-row {
    grid-template-columns: 1fr;
  }
  .dashboard-bottom-row {
    grid-template-columns: 1fr;
  }
}
</style>
