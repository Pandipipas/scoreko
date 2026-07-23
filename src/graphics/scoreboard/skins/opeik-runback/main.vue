<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { playersReplicant, scoreboardReplicant } from '../../../../browser_shared/replicants';
import { resolveCountryCode } from '../../../../shared/countries';
import type { Schemas } from '../../../../types';

import side1WinnersUrl from './img/side1-winners.svg?url';
import side1LosersUrl from './img/side1-losers.svg?url';
import side2WinnersUrl from './img/side2-winners.svg?url';
import side2LosersUrl from './img/side2-losers.svg?url';

useHead({ title: 'Scoreboard' });

const defaultScoreboard: Schemas.Scoreboard = {
  leftPlayerId: '',
  rightPlayerId: '',
  leftNameOverride: '',
  rightNameOverride: '',
  leftTeamOverride: '',
  rightTeamOverride: '',
  leftCountryOverride: '',
  rightCountryOverride: '',
  leftCharacter: '',
  rightCharacter: '',
  leftScore: 0,
  rightScore: 0,
  round: '',
  game: '',
  leftBracketStatus: '',
  rightBracketStatus: '',
};

const players = computed<Schemas.Players>(() => playersReplicant?.data ?? {});
const scoreboard = computed<Schemas.Scoreboard>(() => scoreboardReplicant?.data ?? defaultScoreboard);

const leftName = computed(() => {
  if (scoreboard.value.leftNameOverride) {
    return scoreboard.value.leftNameOverride;
  }
  const player = players.value[scoreboard.value.leftPlayerId];
  return player?.gamertag || 'Player 1';
});

const rightName = computed(() => {
  if (scoreboard.value.rightNameOverride) {
    return scoreboard.value.rightNameOverride;
  }
  const player = players.value[scoreboard.value.rightPlayerId];
  return player?.gamertag || 'Player 2';
});

const leftTeam = computed(() => scoreboard.value.leftTeamOverride || '');

const rightTeam = computed(() => scoreboard.value.rightTeamOverride || '');

const flagModules = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', {
  import: 'default',
  query: '?url',
}) as Record<string, () => Promise<string>>;

const flagUrlCache: Record<string, string> = {};

const leftFlagUrl = ref('');
const rightFlagUrl = ref('');

const loadFlagUrl = async (country: string | undefined) => {
  const code = resolveCountryCode(country)?.toLowerCase();
  if (!code) {
    return '';
  }

  const cached = flagUrlCache[code];
  if (cached) {
    return cached;
  }

  const moduleLoader = flagModules[`/node_modules/flag-icons/flags/4x3/${code}.svg`];
  if (!moduleLoader) {
    return '';
  }

  const url = await moduleLoader();
  flagUrlCache[code] = url;
  return url;
};

watch(
  () => scoreboard.value.leftCountryOverride,
  async (country) => {
    leftFlagUrl.value = await loadFlagUrl(country);
  },
  { immediate: true },
);

watch(
  () => scoreboard.value.rightCountryOverride,
  async (country) => {
    rightFlagUrl.value = await loadFlagUrl(country);
  },
  { immediate: true },
);

const roundText = computed(() => scoreboard.value.round || 'Round');

const leftScoreAnimClass = ref('');
const rightScoreAnimClass = ref('');
let leftScoreTimer: ReturnType<typeof setTimeout> | undefined;
let rightScoreTimer: ReturnType<typeof setTimeout> | undefined;

const triggerScoreAnimation = (side: 'left' | 'right', direction: 'up' | 'down') => {
  const className = direction === 'up' ? 'score-up' : 'score-down';
  if (side === 'left') {
    leftScoreAnimClass.value = '';
    if (leftScoreTimer) {
      clearTimeout(leftScoreTimer);
    }
    void nextTick(() => {
      leftScoreAnimClass.value = className;
      leftScoreTimer = setTimeout(() => {
        leftScoreAnimClass.value = '';
      }, 420);
    });
    return;
  }

  rightScoreAnimClass.value = '';
  if (rightScoreTimer) {
    clearTimeout(rightScoreTimer);
  }
  void nextTick(() => {
    rightScoreAnimClass.value = className;
    rightScoreTimer = setTimeout(() => {
      rightScoreAnimClass.value = '';
    }, 420);
  });
};

const leftSidePanelPath = computed(() => scoreboard.value.leftBracketStatus === 'W' ? side1WinnersUrl : side1LosersUrl);
const rightSidePanelPath = computed(() => scoreboard.value.rightBracketStatus === 'W' ? side2WinnersUrl : side2LosersUrl);

watch(
  () => scoreboard.value.leftScore,
  (nextScore, previousScore) => {
    if (previousScore === undefined || nextScore === previousScore) {
      return;
    }
    triggerScoreAnimation('left', nextScore > previousScore ? 'up' : 'down');
  },
);

watch(
  () => scoreboard.value.rightScore,
  (nextScore, previousScore) => {
    if (previousScore === undefined || nextScore === previousScore) {
      return;
    }
    triggerScoreAnimation('right', nextScore > previousScore ? 'up' : 'down');
  },
);

const progressTextWrapperRef = ref<HTMLElement | null>(null);
const progressTextRef = ref<HTMLElement | null>(null);
const p1NameTextWrapperRef = ref<HTMLElement | null>(null);
const p1NameTextRef = ref<HTMLElement | null>(null);
const p2NameTextWrapperRef = ref<HTMLElement | null>(null);
const p2NameTextRef = ref<HTMLElement | null>(null);
const p1ScoreWrapperRef = ref<HTMLElement | null>(null);
const p1ScoreTextRef = ref<HTMLElement | null>(null);
const p2ScoreWrapperRef = ref<HTMLElement | null>(null);
const p2ScoreTextRef = ref<HTMLElement | null>(null);

const fitText = (container: HTMLElement | null, textElement: HTMLElement | null, maxSize: number, minSize = 1) => {
  if (!container || !textElement) {
    return;
  }

  let low = minSize;
  let high = maxSize;
  let optimal = minSize;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    textElement.style.fontSize = `${mid}px`;

    const overflowsWidth = textElement.scrollWidth > container.clientWidth;
    const overflowsHeight = textElement.scrollHeight > container.clientHeight;

    if (overflowsWidth || overflowsHeight) {
      high = mid - 1;
    } else {
      optimal = mid;
      low = mid + 1;
    }
  }

  textElement.style.fontSize = `${optimal}px`;
};

const refitText = () => {
  fitText(progressTextWrapperRef.value, progressTextRef.value, 35);
  fitText(p1NameTextWrapperRef.value, p1NameTextRef.value, 45);
  fitText(p2NameTextWrapperRef.value, p2NameTextRef.value, 45);
  fitText(p1ScoreWrapperRef.value, p1ScoreTextRef.value, 55);
  fitText(p2ScoreWrapperRef.value, p2ScoreTextRef.value, 55);
};

const scheduleRefit = () => {
  void nextTick(() => {
    refitText();
  });
};

onMounted(() => {
  window.addEventListener('resize', refitText);
  scheduleRefit();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', refitText);
  if (leftScoreTimer) {
    clearTimeout(leftScoreTimer);
  }
  if (rightScoreTimer) {
    clearTimeout(rightScoreTimer);
  }
});

watch(
  () => [
    roundText.value,
    leftTeam.value,
    rightTeam.value,
    leftName.value,
    rightName.value,
    scoreboard.value.leftScore,
    scoreboard.value.rightScore,
  ],
  () => {
    scheduleRefit();
  },
  { immediate: true },
);
</script>

<template>
  <div id="scoreboard">
    <div id="back-panel-wrapper">
      <img
        id="back-panel"
        src="./img/back.svg"
        alt=""
      >
    </div>

    <div id="main-panel-wrapper">
      <img
        id="main-panel"
        src="./img/main.svg"
        alt=""
      >

      <div
        id="progress-text-wrapper"
        ref="progressTextWrapperRef"
      >
        <div
          id="progress-text"
          ref="progressTextRef"
        >
          <Transition
            name="text-fade"
            mode="out-in"
          >
            <span :key="roundText">{{ roundText }}</span>
          </Transition>
        </div>
      </div>

      <Transition name="side-fade">
        <div
          v-if="scoreboard.leftBracketStatus"
          id="p1-side-wrapper"
          class="side-wrapper"
        >
          <img
            :src="leftSidePanelPath"
            alt=""
          >
          <div
            id="p1-side-text"
            class="side-text-wrapper"
          >
            <span>
              {{ scoreboard.leftBracketStatus }}
            </span>
          </div>
        </div>
      </Transition>

      <Transition name="side-fade">
        <div
          v-if="scoreboard.rightBracketStatus"
          id="p2-side-wrapper"
          class="side-wrapper"
        >
          <img
            :src="rightSidePanelPath"
            alt=""
          >
          <div
            id="p2-side-text"
            class="side-text-wrapper"
          >
            <span>
              {{ scoreboard.rightBracketStatus }}
            </span>
          </div>
        </div>
      </Transition>

      <div
        id="p1-games-text-wrapper"
        ref="p1ScoreWrapperRef"
        class="games-text-wrapper"
      >
        <div
          ref="p1ScoreTextRef"
          class="games-text"
          :class="leftScoreAnimClass"
        >
          <Transition
            name="score-flip"
            mode="out-in"
          >
            <span :key="scoreboard.leftScore">{{ scoreboard.leftScore }}</span>
          </Transition>
        </div>
      </div>

      <div
        id="p2-games-text-wrapper"
        ref="p2ScoreWrapperRef"
        class="games-text-wrapper"
      >
        <div
          ref="p2ScoreTextRef"
          class="games-text"
          :class="rightScoreAnimClass"
        >
          <Transition
            name="score-flip"
            mode="out-in"
          >
            <span :key="scoreboard.rightScore">{{ scoreboard.rightScore }}</span>
          </Transition>
        </div>
      </div>

      <div
        id="p1-name-wrapper"
        class="name-wrapper"
      >
        <img
          src="./img/name1.svg"
          alt=""
        >

        <div
          id="p1-name-text-wrapper"
          ref="p1NameTextWrapperRef"
          class="name-text-wrapper"
        >
          <div ref="p1NameTextRef">
            <Transition
              name="text-fade"
              mode="out-in"
            >
              <span :key="`${scoreboard.leftPlayerId}-${leftTeam}-${leftName}`">
                <span
                  v-if="leftTeam"
                  class="team-text"
                >
                  {{ leftTeam }}
                </span>
                <span class="gamertag-text">
                  {{ leftName }}
                </span>
              </span>
            </Transition>
          </div>
        </div>

        <Transition name="flag-swap">
          <div
            v-if="leftFlagUrl"
            id="p1-flag-wrapper"
            :key="`left-${scoreboard.leftCountryOverride}-${leftFlagUrl}`"
            class="flag-wrapper"
          >
            <div class="flag-mask">
              <img
                class="flag"
                :src="leftFlagUrl"
                alt=""
              >
            </div>
          </div>
        </Transition>
      </div>

      <div
        id="p2-name-wrapper"
        class="name-wrapper"
      >
        <img
          src="./img/name2.svg"
          alt=""
        >

        <div
          id="p2-name-text-wrapper"
          ref="p2NameTextWrapperRef"
          class="name-text-wrapper"
        >
          <div ref="p2NameTextRef">
            <Transition
              name="text-fade"
              mode="out-in"
            >
              <span :key="`${scoreboard.rightPlayerId}-${rightTeam}-${rightName}`">
                <span
                  v-if="rightTeam"
                  class="team-text"
                >
                  {{ rightTeam }}
                </span>
                <span class="gamertag-text">
                  {{ rightName }}
                </span>
              </span>
            </Transition>
          </div>
        </div>

        <Transition name="flag-swap">
          <div
            v-if="rightFlagUrl"
            id="p2-flag-wrapper"
            :key="`right-${scoreboard.rightCountryOverride}-${rightFlagUrl}`"
            class="flag-wrapper"
          >
            <div class="flag-mask">
              <img
                class="flag"
                :src="rightFlagUrl"
                alt=""
              >
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './fonts/bebas.css';
@import './fonts/gilroy.css';
@import './fonts/rounded-mplus.css';

:global(:root) {
  --main-panel-height: 60px;
  --main-panel-width: 409.28px;

  --back-panel-height: 50px;
  --back-panel-width: 596.6px;

  --side-panel-height: calc(var(--main-panel-height) * 0.5);
  --side-panel-width: 43px;
  --side-text-height: var(--side-panel-height);
  --side-text-width: var(--side-panel-width);
  --side-end-x: calc(var(--side-panel-width) * 0.8 * -1);

  --name-panel-height: 50px;
  --name-panel-width: 499.19px;
  --name-panel-offset: calc(var(--name-panel-width) * 0.95 * -1);

  --name-text-width: calc(var(--name-panel-width) * 0.845);
  --name-text-height: calc(var(--name-panel-height) * 0.8);
  --name-text-offset-x: calc(var(--name-panel-width) * 0.325);
  --name-text-offset-y: calc(
    var(--name-panel-height) * 0.5 - (var(--name-text-height) * 0.5)
  );

  --flag-height: 50px;
  --flag-width: 120px;
  --flag-offset-x: calc(var(--flag-width) * (0.25 + 0.01));

  --games-text-width: calc(var(--main-panel-width) * 0.11);
  --games-text-height: calc(var(--main-panel-height) * 0.8);
  --games-text-offset-x: calc(var(--main-panel-width) * 0.04);
  --games-text-offset-y: calc(
    var(--main-panel-height) * 0.5 - (var(--games-text-height) * 0.5)
  );

  --progress-text-width: calc(var(--main-panel-width) * 0.65);
  --progress-text-height: calc(var(--main-panel-height) * 0.55);
  --progress-text-offset-x: calc(var(--main-panel-width) * 0.5);
  --progress-text-offset-y: calc(
    var(--main-panel-height) * 0.35 - (var(--progress-text-height) * 0.5)
  );
}

img {
  height: 100%;
}

#scoreboard {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

#back-panel-wrapper {
  position: absolute;
  height: var(--back-panel-height);
  top: 0;
  left: 0;
  z-index: -2;
  transform: translateX(-50%) translate3d(0, 0, 0);
}

#main-panel {
  filter: drop-shadow(0px 5px 5px rgba(34, 34, 34, 0.85));
}

#main-panel-wrapper {
  position: absolute;
  height: var(--main-panel-height);
  top: 0;
  left: 0;
  z-index: 0;
  transform: translateX(-50%);
}

#progress-text-wrapper {
  position: absolute;
  top: var(--progress-text-offset-y);
  left: var(--progress-text-offset-x);
  width: var(--progress-text-width);
  height: var(--progress-text-height);
  text-align: center;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

#progress-text {
  color: #ffffff;
  font-family: 'Bebas Neue Regular', 'Rounded Mplus Regular', sans-serif;
  font-size: 35px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

#p1-name-wrapper {
  left: var(--name-panel-offset);
  padding-left: var(--flag-width);
  margin-left: calc(var(--flag-width) * -1);
  text-align: left;
}

#p2-name-wrapper {
  right: var(--name-panel-offset);
  padding-right: var(--flag-width);
  margin-right: calc(var(--flag-width) * -1);
  text-align: right;
}

#p1-name-text-wrapper {
  left: var(--name-text-offset-x);
  text-align: left;
}

#p2-name-text-wrapper {
  right: var(--name-text-offset-x);
  text-align: right;
}

#p1-games-text-wrapper {
  left: var(--games-text-offset-x);
}

#p2-games-text-wrapper {
  right: var(--games-text-offset-x);
}

.name-wrapper {
  position: absolute;
  height: var(--name-panel-height);
  top: 0;
  z-index: -2;
  overflow: visible;
  padding-bottom: 20px;
  filter: drop-shadow(0px 2px 5px rgba(34, 34, 34, 0.85));
}

.name-text-wrapper {
  position: absolute;
  top: var(--name-text-offset-y);
  height: var(--name-text-height);
  width: var(--name-text-width);
  line-height: var(--name-text-height);
  font-family: 'Bebas Neue Bold', 'Rounded Mplus Bold', sans-serif;
  font-size: 45px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.name-text-wrapper > div {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-text {
  color: #a5a5a5;
  margin-right: 8px;
}

.flag-wrapper {
  position: absolute;
  top: 0;
  height: var(--flag-height);
  width: var(--flag-width);
  z-index: -3;
}

#p1-flag-wrapper {
  left: var(--flag-offset-x);
  clip-path: polygon(0 0, 75% 0, 100% 100%, 25% 100%);
}

#p2-flag-wrapper {
  right: var(--flag-offset-x);
  clip-path: polygon(25% 0, 100% 0, 75% 100%, 0 100%);
}

.flag-mask {
  width: 100%;
  height: var(--flag-height);
}

.flag {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.games-text-wrapper {
  position: absolute;
  top: var(--games-text-offset-y);
  height: var(--games-text-height);
  width: var(--games-text-width);
  text-align: center;
  line-height: var(--games-text-height);
}

.games-text {
  color: #ffffff;
  font-family: 'Gilroy', sans-serif;
  font-weight: bold;
  font-size: 55px;
}

.gamertag-text {
  color: #ffffff;
}

.side-wrapper {
  position: absolute;
  height: var(--side-panel-height);
  width: var(--side-panel-width);
  top: 0;
  z-index: -1;
  overflow: visible;
  filter: drop-shadow(0px 2px 5px rgba(34, 34, 34, 0.85));
}

#p1-side-wrapper {
  left: var(--side-end-x);
}

#p2-side-wrapper {
  right: var(--side-end-x);
}

.side-text-wrapper {
  position: absolute;
  height: var(--side-text-height);
  width: var(--side-text-width);
  top: 0;
  font-family: 'Bebas Neue Bold', 'Rounded Mplus Bold', sans-serif;
  text-align: center;
  line-height: var(--side-panel-height);
  font-size: 30px;
  color: black;
}

.text-fade-enter-active,
.text-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.text-fade-enter-from,
.text-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.score-flip-enter-active,
.score-flip-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
  display: inline-block;
}

.score-flip-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.score-flip-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.score-up {
  animation: score-up-pulse 420ms ease;
}

.score-down {
  animation: score-down-pulse 420ms ease;
}

.flag-swap-enter-active,
.flag-swap-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.flag-swap-enter-from,
.flag-swap-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.side-fade-enter-active,
.side-fade-leave-active {
  transition: opacity 250ms ease, transform 250ms ease;
}

.side-fade-enter-from,
.side-fade-leave-to {
  opacity: 0;
  transform: translateX(0);
}
#p1-side-wrapper.side-fade-enter-from,
#p1-side-wrapper.side-fade-leave-to {
  transform: translateX(10px);
}
#p2-side-wrapper.side-fade-enter-from,
#p2-side-wrapper.side-fade-leave-to {
  transform: translateX(-10px);
}

@keyframes score-up-pulse {
  0% { transform: scale(1); color: #ffffff; }
  50% { transform: scale(1.2); color: #a7ffcf; }
  100% { transform: scale(1); color: #ffffff; }
}

@keyframes score-down-pulse {
  0% { transform: scale(1); color: #ffffff; }
  50% { transform: scale(1.2); color: #ffd0d0; }
  100% { transform: scale(1); color: #ffffff; }
}
</style>
