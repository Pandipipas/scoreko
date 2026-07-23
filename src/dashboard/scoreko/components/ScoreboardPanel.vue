<script setup lang="ts">
defineOptions({ name: 'ScoreboardPanel' });
import { provide } from 'vue';
import { useCharacterGame, CHARACTER_GAME_KEY } from '../composables/useCharacterGame';
import PlayerSidePanel from './PlayerSidePanel.vue';
import ScoreCenterPanel from './ScoreCenterPanel.vue';

const characterGame = useCharacterGame();
provide(CHARACTER_GAME_KEY, characterGame);
</script>

<template>
  <div class="scoreboard-panel">
    <div class="scoreboard-preview">
      <PlayerSidePanel side="left" />
      <ScoreCenterPanel />
      <PlayerSidePanel side="right" />
    </div>
  </div>
</template>

<style scoped>
.scoreboard-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scoreboard-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, auto) minmax(0, 1fr);
  gap: 18px;
  padding: 16px;
  align-items: center;
}

@media (min-width: 1024px) {
  .scoreboard-preview {
    grid-template-columns: minmax(0, 1fr) minmax(320px, auto) minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .scoreboard-preview {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .scoreboard-preview :deep(.scoreboard-preview__center) {
    order: -1;
    justify-self: center;
  }
}
</style>
