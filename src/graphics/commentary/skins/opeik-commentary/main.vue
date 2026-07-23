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

const leftCommentator = computed(() => commentary.value.leftCommentator || 'COMMENTATOR 1');
const leftCommentatorTwitter = computed(() => commentary.value.leftCommentatorTwitter ? `@${commentary.value.leftCommentatorTwitter}` : '');
const rightCommentator = computed(() => commentary.value.rightCommentator || 'COMMENTATOR 2');
const rightCommentatorTwitter = computed(() => commentary.value.rightCommentatorTwitter ? `@${commentary.value.rightCommentatorTwitter}` : '');
</script>

<template>
  <div id="commentary">
    <div id="main-panel-wrapper">
      <img
        id="main-panel"
        src="./img/main.svg"
      >

      <div
        id="p1-name-text-wrapper"
        class="name-text-wrapper text-in"
      >
        <span class="gamertag-text">
          {{ leftCommentator }}
        </span>
      </div>

      <div
        id="p1-twitter-text-wrapper"
        class="twitter-text-wrapper text-in"
      >
        <span class="twitter-text">
          {{ leftCommentatorTwitter }}
        </span>
      </div>

      <div
        id="p2-twitter-text-wrapper"
        class="twitter-text-wrapper text-in"
      >
        <span class="twitter-text">
          {{ rightCommentatorTwitter }}
        </span>
      </div>

      <div
        id="p2-name-text-wrapper"
        class="name-text-wrapper text-in"
      >
        <span class="gamertag-text">
          {{ rightCommentator }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './fonts/bebas.css';
@import './fonts/gilroy.css';
@import './fonts/rounded-mplus.css';

:global(body) {
  margin: 0;
  background: transparent;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

#commentary {
  position: fixed;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
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
  width: 300px;
  line-height: 50px;
  font-family: "Bebas Neue Bold", "Rounded Mplus Bold", sans-serif;
  text-align: center;
  overflow: hidden;
}

.twitter-text-wrapper {
  position: absolute;
  top: 0px;
  height: 40px;
  width: 300px;
  line-height: 40px;
  font-family: "Bebas Neue Regular", "Rounded Mplus Bold", sans-serif;
  text-align: center;
  overflow: hidden;
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
}

.twitter-text {
  color: #a5a5a5;
  font-size: 24px;
  white-space: nowrap;
}

.text-in {
  animation: ani-text-in 0.25s forwards;
  animation-timing-function: linear;
}

.text-out {
  animation: ani-text-out 0.25s forwards;
  animation-timing-function: linear;
}

@keyframes ani-text-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes ani-text-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

img {
  height: 100%;
}
</style>
