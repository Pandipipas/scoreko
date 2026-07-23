<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { defineAsyncComponent, shallowRef, watch, type Component } from 'vue';
import { graphicsSettingsReplicant } from '../../browser_shared/replicants';

useHead({ title: 'Scoreboard' });

const skins: Record<string, Component> = {
  'opeik-runback': defineAsyncComponent(() => import('./skins/opeik-runback/main.vue'))
};

const currentSkinComponent = shallowRef(skins['opeik-runback']);

watch(() => graphicsSettingsReplicant?.data?.scoreboardSkin, (skin) => {
  if (skin && skins[skin]) {
    currentSkinComponent.value = skins[skin];
  } else {
    currentSkinComponent.value = skins['opeik-runback'];
  }
}, { immediate: true });
</script>

<template>
  <component :is="currentSkinComponent" />
</template>

<style>
body {
  margin: 0;
  overflow: hidden;
  background: transparent;
}
</style>
