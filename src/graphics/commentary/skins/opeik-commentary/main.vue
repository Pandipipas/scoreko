<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { computed } from 'vue';
import { commentaryReplicant } from '../../../../browser_shared/replicants';
import type { Schemas } from '../../../../types';

useHead({ title: 'Commentary' });

const defaultCommentary: Schemas.Commentary = {
  leftCommentator: '',
  leftCommentatorTwitter: '',
  rightCommentator: '',
  rightCommentatorTwitter: '',
};

const commentary = computed<Schemas.Commentary>(() => commentaryReplicant?.data ?? defaultCommentary);

const formatTwitter = (handle?: string) => {
  if (!handle) return '';
  const trimmed = handle.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

const hasAnyCommentator = computed(() => Boolean(commentary.value.leftCommentator?.trim() || commentary.value.rightCommentator?.trim()));

const leftCommentator = computed(() => {
  const val = commentary.value.leftCommentator?.trim();
  if (val) return val;
  if (!hasAnyCommentator.value) return 'COMMENTATOR 1';
  return '';
});

const rightCommentator = computed(() => {
  const val = commentary.value.rightCommentator?.trim();
  if (val) return val;
  if (!hasAnyCommentator.value) return 'COMMENTATOR 2';
  return '';
});

const leftCommentatorTwitter = computed(() => leftCommentator.value ? formatTwitter(commentary.value.leftCommentatorTwitter) : '');
const rightCommentatorTwitter = computed(() => rightCommentator.value ? formatTwitter(commentary.value.rightCommentatorTwitter) : '');
</script>

<template>
  <div id="commentary">
    <div id="main-panel-wrapper">
      <img
        id="main-panel"
        src="./img/main.svg"
        alt=""
      >

      <div
        v-if="leftCommentator"
        id="p1-name-text-wrapper"
        class="name-text-wrapper"
      >
        <Transition
          name="text-fade"
          mode="out-in"
        >
          <span
            :key="leftCommentator"
            class="gamertag-text"
          >
            {{ leftCommentator }}
          </span>
        </Transition>
      </div>

      <div
        v-if="leftCommentatorTwitter"
        id="p1-twitter-text-wrapper"
        class="twitter-text-wrapper"
      >
        <Transition
          name="text-fade"
          mode="out-in"
        >
          <span
            :key="leftCommentatorTwitter"
            class="twitter-text"
          >
            {{ leftCommentatorTwitter }}
          </span>
        </Transition>
      </div>

      <div
        v-if="rightCommentatorTwitter"
        id="p2-twitter-text-wrapper"
        class="twitter-text-wrapper"
      >
        <Transition
          name="text-fade"
          mode="out-in"
        >
          <span
            :key="rightCommentatorTwitter"
            class="twitter-text"
          >
            {{ rightCommentatorTwitter }}
          </span>
        </Transition>
      </div>

      <div
        v-if="rightCommentator"
        id="p2-name-text-wrapper"
        class="name-text-wrapper"
      >
        <Transition
          name="text-fade"
          mode="out-in"
        >
          <span
            :key="rightCommentator"
            class="gamertag-text"
          >
            {{ rightCommentator }}
          </span>
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
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Gilroy', monospace;
}

:global(body) {
  margin: 0;
  background: transparent;
  overflow: hidden;
  font-family: 'Bebas Neue Regular', 'Rounded Mplus Bold', 'Segoe UI', sans-serif;
}

#commentary {
  position: fixed;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
}

#main-panel {
  filter: drop-shadow(0px 5px 5px #222);
}

#main-panel-wrapper {
  position: absolute;
  height: 100px;
  bottom: 25%;
  left: 50%;
  z-index: 0;
  transform: translateX(-50%);
}

.name-text-wrapper {
  position: absolute;
  top: 45px;
  height: 50px;
  width: 260px;
  line-height: 50px;
  font-family: 'Bebas Neue Bold', 'Rounded Mplus Bold', var(--font-mono, monospace), sans-serif;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.twitter-text-wrapper {
  position: absolute;
  top: 0px;
  height: 40px;
  width: 260px;
  line-height: 40px;
  font-family: 'Bebas Neue Regular', 'Rounded Mplus Bold', var(--font-mono, monospace), sans-serif;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

#p1-name-text-wrapper {
  left: 50px;
}

#p1-twitter-text-wrapper {
  left: 50px;
}

#p2-twitter-text-wrapper {
  right: 50px;
}

#p2-name-text-wrapper {
  right: 50px;
}

.gamertag-text {
  color: white;
  font-size: 38px;
  white-space: nowrap;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.twitter-text {
  color: #a5a5a5;
  font-size: 24px;
  white-space: nowrap;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-fade-enter-active,
.text-fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.text-fade-enter-from,
.text-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

img {
  height: 100%;
}
</style>

