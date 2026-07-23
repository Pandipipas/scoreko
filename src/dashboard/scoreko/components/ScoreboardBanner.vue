<script setup lang="ts">
defineOptions({ name: 'ScoreboardBanner' });
import { computed, inject } from 'vue';
import { CHARACTER_GAME_KEY } from '../composables/useCharacterGame';
import { useScoreboardStore } from '../stores/scoreboard';
import { usePlayersStore } from '../stores/players';
import { t } from '../i18n';

const scoreboardStore = useScoreboardStore();
const playersStore = usePlayersStore();

const {
  leftCharacterImage,
  rightCharacterImage,
  leftCharacterInput,
  rightCharacterInput,
} = inject(CHARACTER_GAME_KEY)!;

const getDisplayName = (side: 'left' | 'right') => {
  const sb = scoreboardStore.scoreboard;
  const nameOverride = side === 'left' ? sb.leftNameOverride : sb.rightNameOverride;
  if (nameOverride) return nameOverride;
  const playerId = side === 'left' ? sb.leftPlayerId : sb.rightPlayerId;
  const player = playersStore.players[playerId];
  return player?.gamertag || '';
};

const leftDisplayName = computed(() => getDisplayName('left'));
const rightDisplayName = computed(() => getDisplayName('right'));

const getTeamName = (side: 'left' | 'right') => {
  const sb = scoreboardStore.scoreboard;
  const teamOverride = side === 'left' ? sb.leftTeamOverride : sb.rightTeamOverride;
  if (teamOverride) return teamOverride;
  const playerId = side === 'left' ? sb.leftPlayerId : sb.rightPlayerId;
  const player = playersStore.players[playerId];
  return player?.team || '';
};

const leftTeamName = computed(() => getTeamName('left'));
const rightTeamName = computed(() => getTeamName('right'));

const hasLeftData = computed(() => !!(leftDisplayName.value || leftTeamName.value || leftCharacterInput.value || leftCharacterImage.value));
const hasRightData = computed(() => !!(rightDisplayName.value || rightTeamName.value || rightCharacterInput.value || rightCharacterImage.value));

const leftLabel = computed(() => t('scoreboardLeft'));
const rightLabel = computed(() => t('scoreboardRight'));
</script>

<template>
  <div class="scoreboard-banner glass-panel">
    <div class="scoreboard-banner__side scoreboard-banner__side--left">
      <div class="scoreboard-banner__image-wrap">
        <img
          v-if="leftCharacterImage"
          :src="leftCharacterImage"
          class="scoreboard-banner__image scoreboard-banner__image--left"
          alt=""
        >
      </div>
      <div class="scoreboard-banner__info scoreboard-banner__info--left">
        <div
          v-if="leftTeamName || hasLeftData"
          class="scoreboard-banner__title"
        >
          {{ leftTeamName || (leftDisplayName || leftCharacterInput ? '' : t('scoreboardLeft')) }}
        </div>
        <div
          v-if="hasLeftData"
          class="scoreboard-banner__name"
        >
          {{ leftDisplayName || leftCharacterInput || leftLabel }}
        </div>
      </div>
    </div>

    <div class="scoreboard-banner__center">
      <div class="scoreboard-banner__score">
        <span class="score-value">{{ scoreboardStore.scoreboard.leftScore }}</span>
        <span class="score-dash">-</span>
        <span class="score-value">{{ scoreboardStore.scoreboard.rightScore }}</span>
      </div>
    </div>

    <div class="scoreboard-banner__side scoreboard-banner__side--right">
      <div class="scoreboard-banner__info scoreboard-banner__info--right">
        <div
          v-if="rightTeamName || hasRightData"
          class="scoreboard-banner__title"
        >
          {{ rightTeamName || (rightDisplayName || rightCharacterInput ? '' : t('scoreboardRight')) }}
        </div>
        <div
          v-if="hasRightData"
          class="scoreboard-banner__name"
        >
          {{ rightDisplayName || rightCharacterInput || rightLabel }}
        </div>
      </div>
      <div class="scoreboard-banner__image-wrap">
        <img
          v-if="rightCharacterImage"
          :src="rightCharacterImage"
          class="scoreboard-banner__image scoreboard-banner__image--right"
          alt=""
        >
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

.scoreboard-banner {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  height: clamp(200px, 25vh, 320px);
  position: relative;
  overflow: hidden;
  border-radius: 12px;
}

.scoreboard-banner__side {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.scoreboard-banner__side--left {
  justify-content: flex-start;
}

.scoreboard-banner__side--right {
  justify-content: flex-end;
}

.scoreboard-banner__image-wrap {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  max-width: 50%;
  pointer-events: none;
}

.scoreboard-banner__side--left .scoreboard-banner__image-wrap {
  left: 0;
}

.scoreboard-banner__side--right .scoreboard-banner__image-wrap {
  right: 0;
}

.scoreboard-banner__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  transform: scale(1.1);
  transform-origin: top center;
}

.scoreboard-banner__image--left {
  mask-image: linear-gradient(to right, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to right, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%);
}

.scoreboard-banner__image--right {
  mask-image: linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%);
}

.scoreboard-banner__empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 600;
}

.scoreboard-banner__info {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px;
  z-index: 2;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

.scoreboard-banner__info--left {
  text-align: left;
  align-items: flex-start;
}

.scoreboard-banner__info--right {
  text-align: right;
  align-items: flex-end;
}

.scoreboard-banner__title {
  font-size: clamp(1rem, 1.5vw, 1.5rem);
  font-weight: 400;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.scoreboard-banner__name {
  font-size: clamp(1.5rem, 2.5vw, 2.5rem);
  font-weight: 800;
  color: #fff;
  line-height: 1.1;
}

.scoreboard-banner__center {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  padding: 0 32px;
}

.scoreboard-banner__score {
  display: flex;
  align-items: center;
  gap: 24px;
}

.score-value {
  font-size: clamp(6rem, 8vw, 10rem);
  font-weight: 900;
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
}

.score-dash {
  font-size: clamp(4rem, 6vw, 6rem);
  font-weight: 300;
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 768px) {
  .scoreboard-banner {
    flex-direction: column;
    height: auto;
  }
  .scoreboard-banner__side {
    height: 150px;
  }
  .scoreboard-banner__center {
    padding: 16px 0;
  }
}
</style>
