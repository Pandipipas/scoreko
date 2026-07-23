<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useBracketStore } from '../stores/bracket';
import type { BracketSet } from '../../../extension/util/types';
import QuickMatchItem from './QuickMatchItem.vue';
import { integrationAuthStateReplicant } from '../../../browser_shared/replicants';
import { RouterLink } from 'vue-router';
import { t } from '../i18n';

defineOptions({ name: 'QuickMatchesPanel' });

const bracketStore = useBracketStore();

const randomMatches = ref<BracketSet[]>([]);

const pickRandomMatches = () => {
  const matches = bracketStore.matches;
  if (!matches || matches.length === 0) {
    randomMatches.value = [];
    return;
  }
  
  const playablePool = matches.filter((m: BracketSet) => m.state === 'in_progress');
  
  const shuffled = playablePool.sort(() => 0.5 - Math.random());
  randomMatches.value = shuffled.slice(0, 3);
};

watch(() => bracketStore.matches, pickRandomMatches, { immediate: true });

const hasAnyIntegration = computed(() => {
  const data = integrationAuthStateReplicant?.data;
  if (!data) return false;
  return Object.values(data).some(v => v);
});

const isTournamentAttached = computed(() => {
  return bracketStore.attached.provider !== null;
});
</script>

<template>
  <div class="quick-matches-panel">
    <div class="panel-header q-mb-md flex justify-between items-center">
      <div
        class="text-subtitle1 text-weight-medium"
        style="color: var(--text-base);"
      >
        {{ t('quickMatchesTitle') }}
      </div>
    </div>
    
    <div
      v-if="!isTournamentAttached"
      class="text-caption q-mt-sm text-center q-pa-md"
      style="color: var(--text-muted)"
    >
      <template v-if="!hasAnyIntegration">
        {{ t('quickMatchesConnectHint') }}
        <br>
        <RouterLink
          to="/settings#integrations"
          class="text-primary text-weight-medium"
          style="text-decoration: none;"
        >
          {{ t('settingsTitle') }}
        </RouterLink>
      </template>
      <template v-else>
        {{ t('quickMatchesNoPinnedHint') }}
        <br>
        <RouterLink
          to="/tournament"
          class="text-primary text-weight-medium"
          style="text-decoration: none;"
        >
          {{ t('menuTournament') }}
        </RouterLink>
      </template>
    </div>

    <div
      v-else-if="randomMatches.length === 0"
      class="text-caption text-grey text-center q-pa-md"
    >
      {{ t('quickMatchesNoPlayable') }}
    </div>
    
    <QList
      v-else
      separator
      class="quick-matches-list"
    >
      <QuickMatchItem 
        v-for="match in randomMatches" 
        :key="match.id" 
        :match="match" 
      />
    </QList>
  </div>
</template>

<style scoped lang="scss">

.quick-matches-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.quick-matches-list {
  flex: 1;
  overflow-y: auto;
}
</style>
