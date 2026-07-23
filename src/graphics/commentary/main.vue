<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { defineAsyncComponent, shallowRef, watch, type Component } from 'vue';
import { graphicsSettingsReplicant } from '../../browser_shared/replicants';

useHead({ title: 'Commentary' });

const skins: Record<string, Component> = {
  'opeik-commentary': defineAsyncComponent(() => import('./skins/opeik-commentary/main.vue'))
};

const currentSkinComponent = shallowRef(skins['opeik-commentary']);

watch(() => graphicsSettingsReplicant?.data?.commentarySkin, (skin) => {
  if (skin && skins[skin]) {
    currentSkinComponent.value = skins[skin];
  } else {
    currentSkinComponent.value = skins['opeik-commentary'];
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
