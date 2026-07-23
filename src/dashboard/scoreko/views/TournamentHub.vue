<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useQuasar } from 'quasar';
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { TEMP_FALLBACK_DURATION_SECONDS, LS_KEYS } from '../../../shared/constants';
import challongeIcoUrl from '../assets/challonge.ico';
import startggSvgUrl from '../assets/startgg.svg';
import BracketMatchCard from '../components/BracketMatchCard.vue';
import { useIntegration } from '../composables/useIntegration';
import { useBracketStore } from '../stores/bracket';
import { usePlayersStore } from '../stores/players';
import { t } from '../i18n';

defineOptions({ name: 'TournamentHubView' });

useHead({ title: 'Tournament Hub' });

const STARTGG_TEMP_PLAYERS_STORAGE_KEY = LS_KEYS.STARTGG_TEMP_PLAYERS;
const CHALLONGE_TEMP_PLAYERS_STORAGE_KEY = LS_KEYS.CHALLONGE_TEMP_PLAYERS;

const bracketStore = useBracketStore();
const playersStore = usePlayersStore();
const $q = useQuasar();
const router = useRouter();

const bracketScrollContainer = ref<HTMLElement | null>(null);
const isDraggingBracket = ref(false);
const startX = ref(0);
const startY = ref(0);
const initialScrollLeft = ref(0);
const initialScrollTop = ref(0);

const onBracketDragStart = (e: MouseEvent) => {
  if (!bracketScrollContainer.value) return;
  
  if ((e.target as HTMLElement).closest('.q-btn, .match-grid-card')) return;
  
  isDraggingBracket.value = true;
  startX.value = e.pageX - bracketScrollContainer.value.offsetLeft;
  startY.value = e.pageY - bracketScrollContainer.value.offsetTop;
  initialScrollLeft.value = bracketScrollContainer.value.scrollLeft;
  initialScrollTop.value = bracketScrollContainer.value.scrollTop;
  bracketScrollContainer.value.style.cursor = 'grabbing';
  bracketScrollContainer.value.style.userSelect = 'none';
};

const onBracketDragMove = (e: MouseEvent) => {
  if (!isDraggingBracket.value || !bracketScrollContainer.value) return;
  e.preventDefault();
  const x = e.pageX - bracketScrollContainer.value.offsetLeft;
  const y = e.pageY - bracketScrollContainer.value.offsetTop;
  const walkX = (x - startX.value) * 1.5;
  const walkY = (y - startY.value) * 1.5;
  bracketScrollContainer.value.scrollLeft = initialScrollLeft.value - walkX;
  bracketScrollContainer.value.scrollTop = initialScrollTop.value - walkY;
};

const onBracketDragEnd = () => {
  if (!isDraggingBracket.value || !bracketScrollContainer.value) return;
  isDraggingBracket.value = false;
  bracketScrollContainer.value.style.cursor = 'grab';
  bracketScrollContainer.value.style.userSelect = '';
};

const startgg = useIntegration({
  messagePrefix: 'startgg',
  providerLabel: 'start.gg',
  tempPlayersStorageKey: STARTGG_TEMP_PLAYERS_STORAGE_KEY,
  tempFallbackDurationSeconds: TEMP_FALLBACK_DURATION_SECONDS,
  playersStore,
});

const challonge = useIntegration({
  messagePrefix: 'challonge',
  providerLabel: 'Challonge',
  tempPlayersStorageKey: CHALLONGE_TEMP_PLAYERS_STORAGE_KEY,
  tempFallbackDurationSeconds: TEMP_FALLBACK_DURATION_SECONDS,
  playersStore,
});

watch(() => startgg.selectedTournamentSlug, (slug) => {
  if (slug && bracketStore.provider === 'startgg' && bracketStore.startggTournamentSlug !== slug) {
    bracketStore.fetchStartggEvents(slug);
  }
});

watch(() => challonge.selectedTournamentSlug, (slug) => {
  if (slug && bracketStore.provider === 'challonge' && bracketStore.challongeTournamentSlug !== slug) {
    bracketStore.fetchChallongeMatches(slug);
  }
});

watch(() => bracketStore.startggTournamentSlug, (slug) => {
  if (slug && startgg.selectedTournamentSlug !== slug) {
    startgg.selectedTournamentSlug = slug;
  }
}, { immediate: true });

watch(() => bracketStore.challongeTournamentSlug, (slug) => {
  if (slug && challonge.selectedTournamentSlug !== slug) {
    challonge.selectedTournamentSlug = slug;
  }
}, { immediate: true });

const setupStep = ref(1);

const setProvider = (prov: 'startgg' | 'challonge') => {
  bracketStore.provider = prov;
  manualUrl.value = '';
  showAdvancedSearch.value = false;
};

const showAdvancedSearch = ref(false);

const onContinueStep1 = () => {
  if (!bracketStore.provider) {
    $q.notify({ type: 'warning', message: `${t('bracketProvider')} is required.` });
    return;
  }
  if (bracketStore.provider === 'startgg' && !startgg.hasTokenConfigured) {
    $q.notify({
      type: 'negative',
      message: t('tournamentStartggNotConnected'),
      actions: [{ label: t('menuSettings'), color: 'white', handler: () => { router.push('/settings#integrations'); } }]
    });
    return;
  }
  if (bracketStore.provider === 'challonge' && !challonge.hasTokenConfigured) {
    $q.notify({
      type: 'negative',
      message: t('tournamentChallongeNotConnected'),
      actions: [{ label: t('menuSettings'), color: 'white', handler: () => { router.push('/settings#integrations'); } }]
    });
    return;
  }
  setupStep.value = 2;
};

const onContinueStep2 = () => {
  if (bracketStore.provider === 'startgg' && !startgg.selectedTournamentSlug) {
    $q.notify({ type: 'warning', message: t('playersSelectTournamentFirst') });
    return;
  }
  if (bracketStore.provider === 'challonge' && !challonge.selectedTournamentSlug) {
    $q.notify({ type: 'warning', message: t('playersSelectTournamentFirst') });
    return;
  }
  setupStep.value = 3;
};

const onContinueStep3 = () => {
  if (!bracketStore.startggGroupId) {
    $q.notify({ type: 'warning', message: t('tournamentSelectPoolGroup') });
    return;
  }
  setupStep.value = 4;
};

const startggTopTournaments = computed(() => startgg.tournamentOptions.slice(0, 5));
const challongeTopTournaments = computed(() => challonge.tournamentOptions.slice(0, 5));

const manualUrl = ref('');

const parseStartggUrl = (val: string): { slug: string | null; error: boolean } => {
  try {
    const parsed = new URL(val);
    if (parsed.hostname.includes('start.gg') || parsed.hostname.includes('smash.gg')) {
      const match = parsed.pathname.match(/^\/(tournament\/[^/]+)/);
      if (match) return { slug: match[1] || null, error: false };
    }
    return { slug: null, error: true };
  } catch {
    if (val.startsWith('http')) return { slug: null, error: true };
    return { slug: val, error: false };
  }
};

const parseChallongeUrl = (val: string): { slug: string | null; error: boolean } => {
  try {
    const parsed = new URL(val);
    if (parsed.hostname.includes('challonge.com')) {
      let slug = parsed.pathname.split('/')[1];
      const subdomainMatch = parsed.hostname.match(/^([^.]+)\.challonge\.com/);
      if (subdomainMatch && subdomainMatch[1] !== 'www') {
        slug = `${subdomainMatch[1]}-${slug}`;
      }
      return { slug: slug || null, error: false };
    }
    return { slug: null, error: true };
  } catch {
    if (val.startsWith('http')) return { slug: null, error: true };
    return { slug: val, error: false };
  }
};

const manualUrlError = ref(false);
const manualUrlErrorMessage = ref('');

const onManualUrlInput = (val: string | number | null) => {
  manualUrlError.value = false;
  if (!val) {
    if (bracketStore.provider === 'startgg') startgg.selectedTournamentSlug = '';
    if (bracketStore.provider === 'challonge') challonge.selectedTournamentSlug = '';
    return;
  }
  
  const strVal = String(val).trim();
  if (bracketStore.provider === 'startgg') {
    const { slug, error } = parseStartggUrl(strVal);
    if (error) {
      manualUrlError.value = true;
      manualUrlErrorMessage.value = 'Invalid start.gg URL';
    } else if (slug) {
      startgg.selectedTournamentSlug = slug;
    }
  } else {
    const { slug, error } = parseChallongeUrl(strVal);
    if (error) {
      manualUrlError.value = true;
      manualUrlErrorMessage.value = 'Invalid Challonge URL';
    } else if (slug) {
      challonge.selectedTournamentSlug = slug;
    }
  }
};

const adminWarning = computed(() => {
  if (bracketStore.provider === 'startgg' && startgg.selectedTournamentSlug) {
    return !startgg.tournamentOptions.some(o => o.value === startgg.selectedTournamentSlug);
  }
  if (bracketStore.provider === 'challonge' && challonge.selectedTournamentSlug) {
    return !challonge.tournamentOptions.some(o => o.value === challonge.selectedTournamentSlug);
  }
  return false;
});

const showOnlyPlayable = ref(true);
const hideCompleted = ref(false);
const viewMode = ref<'grid' | 'bracket'>('grid');

const filteredMatches = computed(() => {
  let matches = bracketStore.matches;
  if (showOnlyPlayable.value) {
    matches = matches.filter((m: import('../../../extension/util/types').BracketSet) => m.state !== 'pending');
  }
  if (hideCompleted.value) {
    matches = matches.filter((m: import('../../../extension/util/types').BracketSet) => m.state !== 'completed');
  }
  return matches;
});

const gridMatches = computed(() => {
  
  const reversed = [...filteredMatches.value].reverse();

  
  return reversed.sort((a, b) => {
    const aPending = a.state === 'pending';
    const bPending = b.state === 'pending';
    if (aPending !== bPending) {
      return aPending ? 1 : -1;
    }
    return 0; 
  });
});

const winnersMatchesByRound = computed(() => {
  const map = new Map<number, typeof bracketStore.matches>();
  filteredMatches.value.forEach((m: import('../../../extension/util/types').BracketSet) => {
    if (m.round > 0) {
      if (!map.has(m.round)) map.set(m.round, []);
      map.get(m.round)!.push(m);
    }
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({ round, matches }));
});

const losersMatchesByRound = computed(() => {
  const map = new Map<number, typeof bracketStore.matches>();
  filteredMatches.value.forEach((m: import('../../../extension/util/types').BracketSet) => {
    if (m.round < 0) {
      if (!map.has(m.round)) map.set(m.round, []);
      map.get(m.round)!.push(m);
    }
  });
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([round, matches]) => ({ round, matches }));
});

const hasPinnedTournament = computed(() => {
  return bracketStore.attached.provider !== null;
});

const pinnedTournamentName = computed(() => {
  const slug = bracketStore.attached.tournamentSlug;
  if (!slug) return '';
  
  if (bracketStore.attached.provider === 'startgg') {
    const opt = startgg.tournamentOptions.find(o => o.value === slug);
    return opt ? opt.label : slug;
  } else if (bracketStore.attached.provider === 'challonge') {
    const opt = challonge.tournamentOptions.find(o => o.value === slug);
    return opt ? opt.label : slug;
  }
  return slug;
});

const playersImported = ref(false);
const isImportingPlayers = ref(false);

const onImportPlayersFirst = async () => {
  isImportingPlayers.value = true;
  if (bracketStore.provider === 'startgg' && startgg.selectedTournamentOption) {
    try {
      await startgg.autoImportAllPlayers(startgg.selectedTournamentOption);
      $q.notify({ type: 'positive', message: t('bracketAttachSuccess') });
    } catch {
      $q.notify({ type: 'negative', message: t('bracketAttachPartial') });
    }
  } else if (bracketStore.provider === 'challonge' && challonge.selectedTournamentOption) {
    try {
      await challonge.autoImportAllPlayers(challonge.selectedTournamentOption);
      $q.notify({ type: 'positive', message: t('bracketAttachSuccess') });
    } catch {
      $q.notify({ type: 'negative', message: t('bracketAttachPartial') });
    }
  }
  isImportingPlayers.value = false;
  playersImported.value = true;
};

const onPinAndFinish = () => {
  bracketStore.attachTournament();
  playersImported.value = false;
  setupStep.value = 1;
};

</script>

<template>
  <QPage
    padding
    class="bracket-page"
  >
    <QBanner
      v-if="bracketStore.error"
      class="bg-negative text-white q-mb-md rounded-borders"
    >
      <template #avatar>
        <q-icon
          name="error"
          color="white"
        />
      </template>
      {{ bracketStore.error }}
    </QBanner>

    <div class="bracket-content row q-col-gutter-md">
      <div class="col-12 col-md-4 col-lg-3">
        <QCard 
          v-if="hasPinnedTournament"
          flat 
          bordered 
          class="glass-panel q-pa-md"
        >
          <div class="text-subtitle1 text-weight-bold q-mb-sm text-center text-primary">
            🏆 Currently Covering
          </div>
          <div
            class="text-h6 text-center q-mb-lg"
            style="line-height: 1.2;"
          >
            {{ pinnedTournamentName }}
          </div>
          <QBtn
            unelevated
            no-caps
            color="negative"
            icon="close"
            :label="t('bracketDetach')"
            class="negative-action-btn full-width text-weight-bold"
            @click="bracketStore.detachTournament()"
          />
        </QCard>

        
        <QCard 
          v-else
          flat 
          bordered 
          class="glass-panel"
        >
          <div class="q-pa-md q-pb-none">
            <div class="text-subtitle1 text-weight-bold text-primary">
              <QIcon
                name="account_tree"
                size="sm"
                class="q-mr-xs"
              />
              Track Tournament
            </div>
            <div class="text-caption text-grey-5">
              Select a bracket to cover on stream.
            </div>
          </div>
          <QStepper
            v-model="setupStep"
            vertical
            color="primary"
            animated
            flat
            class="bg-transparent"
          >
            <QStep
              :name="1"
              :title="t('bracketProvider')"
              icon="settings"
              :done="setupStep > 1"
            >
              <div class="row q-gutter-sm">
                <QBtn
                  flat
                  no-caps
                  class="sleek-select-btn"
                  :class="{ 'active-selection': bracketStore.provider === 'startgg' }"
                  @click="setProvider('startgg')"
                >
                  <img
                    :src="startggSvgUrl"
                    alt="start.gg"
                    style="width: 16px; height: 16px; margin-right: 8px;"
                  >
                  start.gg
                </QBtn>
                <QBtn
                  flat
                  no-caps
                  class="sleek-select-btn"
                  :class="{ 'active-selection': bracketStore.provider === 'challonge' }"
                  @click="setProvider('challonge')"
                >
                  <img
                    :src="challongeIcoUrl"
                    alt="Challonge"
                    style="width: 16px; height: 16px; margin-right: 8px;"
                  >
                  Challonge
                </QBtn>
              </div>
              <QStepperNavigation>
                <QBtn 
                  unelevated
                  no-caps
                  color="primary" 
                  :label="t('tournamentBtnContinue')" 
                  class="primary-action-btn"
                  @click="onContinueStep1" 
                />
              </QStepperNavigation>
            </QStep>

            
            <QStep
              :name="2"
              :title="t('bracketTournament')"
              icon="search"
              :done="setupStep > 2"
            >
              <div
                v-if="bracketStore.provider === 'startgg'"
                class="column q-gutter-md"
              >
                <div v-if="startggTopTournaments.length > 0">
                  <div class="text-caption text-grey-5 q-mb-sm">
                    Recent Tournaments
                  </div>
                  <div class="column q-gutter-sm">
                    <QBtn 
                      v-for="tourn in startggTopTournaments" 
                      :key="tourn.value" 
                      flat
                      no-caps
                      align="left"
                      class="sleek-select-btn"
                      :class="{ 'active-selection': startgg.selectedTournamentSlug === tourn.value }"
                      @click="startgg.selectedTournamentSlug = tourn.value"
                    >
                      <div class="row items-center justify-between full-width">
                        <span>{{ tourn.label }}</span>
                        <QIcon
                          v-if="startgg.selectedTournamentSlug === tourn.value"
                          name="check"
                          size="16px"
                        />
                      </div>
                    </QBtn>
                  </div>
                </div>

                <div
                  v-if="!showAdvancedSearch && startggTopTournaments.length > 0"
                  class="q-mt-md text-center"
                >
                  <QBtn 
                    flat
                    no-caps
                    size="sm"
                    color="grey-5"
                    class="subtle-action-btn"
                    :label="t('tournamentNotListed')" 
                    icon="search"
                    @click="showAdvancedSearch = true"
                  />
                </div>

                <template v-if="showAdvancedSearch || startggTopTournaments.length === 0">
                  <QSelect
                    v-model="startgg.selectedTournamentSlug"
                    v-model:input-value="startgg.tournamentInput"
                    :options="startgg.filteredTournamentOptions"
                    option-value="value"
                    option-label="label"
                    emit-value
                    map-options
                    use-input
                    hide-selected
                    fill-input
                    input-debounce="0"
                    dense
                    :label="t('tournamentSearchOther')"
                    class="underlined-field q-mt-md"
                    popup-content-class="glass-panel glass-dropdown"
                    @filter="startgg.filterTournaments"
                  />

                  <QInput
                    v-model="manualUrl"
                    dense
                    :label="t('tournamentPasteUrlSlug')"
                    class="underlined-field"
                    :error="manualUrlError"
                    :error-message="manualUrlErrorMessage"
                    @update:model-value="onManualUrlInput"
                  />
                </template>
              </div>
              <div
                v-if="bracketStore.provider === 'challonge'"
                class="column q-gutter-md"
              >
                <div v-if="challongeTopTournaments.length > 0">
                  <div class="text-caption text-grey-5 q-mb-sm">
                    Recent Tournaments
                  </div>
                  <div class="column q-gutter-sm">
                    <QBtn 
                      v-for="tourn in challongeTopTournaments" 
                      :key="tourn.value" 
                      flat
                      no-caps
                      align="left"
                      class="sleek-select-btn"
                      :class="{ 'active-selection': challonge.selectedTournamentSlug === tourn.value }"
                      @click="challonge.selectedTournamentSlug = tourn.value"
                    >
                      <div class="row items-center justify-between full-width">
                        <span>{{ tourn.label }}</span>
                        <QIcon
                          v-if="challonge.selectedTournamentSlug === tourn.value"
                          name="check"
                          size="16px"
                        />
                      </div>
                    </QBtn>
                  </div>
                </div>

                <div
                  v-if="!showAdvancedSearch && challongeTopTournaments.length > 0"
                  class="q-mt-md text-center"
                >
                  <QBtn 
                    flat
                    no-caps
                    size="sm"
                    color="grey-5"
                    class="subtle-action-btn"
                    :label="t('tournamentNotListed')" 
                    icon="search"
                    @click="showAdvancedSearch = true"
                  />
                </div>

                <template v-if="showAdvancedSearch || challongeTopTournaments.length === 0">
                  <QSelect
                    v-model="challonge.selectedTournamentSlug"
                    v-model:input-value="challonge.tournamentInput"
                    :options="challonge.filteredTournamentOptions"
                    option-value="value"
                    option-label="label"
                    emit-value
                    map-options
                    use-input
                    hide-selected
                    fill-input
                    input-debounce="0"
                    dense
                    :label="t('tournamentSearchOther')"
                    class="underlined-field q-mt-md"
                    popup-content-class="glass-panel glass-dropdown"
                    @filter="challonge.filterTournaments"
                  />

                  <QInput
                    v-model="manualUrl"
                    dense
                    :label="t('tournamentPasteUrlSlug')"
                    class="underlined-field"
                    :error="manualUrlError"
                    :error-message="manualUrlErrorMessage"
                    @update:model-value="onManualUrlInput"
                  />
                </template>
              </div>

              <div
                v-if="adminWarning"
                class="text-warning text-caption q-mt-sm"
              >
                ⚠️ This tournament is not in your recent admin list. You can still track it, but Player Auto-import and Match Reporting will fail if you don't have permissions.
              </div>
              <QStepperNavigation>
                <QBtn 
                  unelevated
                  no-caps
                  color="primary" 
                  :label="t('tournamentBtnContinue')" 
                  class="primary-action-btn"
                  @click="onContinueStep2" 
                />
                <QBtn 
                  flat 
                  no-caps
                  color="primary" 
                  :label="t('tournamentBtnBack')" 
                  class="flat-back-btn q-ml-sm" 
                  @click="setupStep = 1" 
                />
              </QStepperNavigation>
            </QStep>

            
            <QStep
              v-if="bracketStore.provider === 'startgg'"
              :name="3"
              title="Select Bracket"
              icon="account_tree"
              :done="setupStep > 3"
            >
              <div class="column q-gutter-md">
                <QSelect
                  v-if="bracketStore.events.length"
                  v-model="bracketStore.startggEventId"
                  :options="bracketStore.events"
                  option-value="id"
                  option-label="name"
                  emit-value
                  map-options
                  dense
                  :label="t('bracketEvent')"
                  class="underlined-field"
                  @update:model-value="bracketStore.fetchStartggPhases"
                />

                <QSelect
                  v-if="bracketStore.phases.length"
                  v-model="bracketStore.startggPhaseId"
                  :options="bracketStore.phases"
                  option-value="id"
                  option-label="name"
                  emit-value
                  map-options
                  dense
                  :label="t('bracketPhase')"
                  class="underlined-field"
                  @update:model-value="bracketStore.fetchStartggGroups"
                />

                <QSelect
                  v-if="bracketStore.groups.length"
                  v-model="bracketStore.startggGroupId"
                  :options="bracketStore.groups"
                  option-value="id"
                  option-label="name"
                  emit-value
                  map-options
                  dense
                  :label="t('bracketPool')"
                  class="underlined-field"
                  @update:model-value="bracketStore.fetchStartggSets"
                />
              </div>
              <QStepperNavigation>
                <QBtn 
                  unelevated
                  no-caps
                  color="primary" 
                  :label="t('tournamentBtnContinue')" 
                  class="primary-action-btn"
                  @click="onContinueStep3" 
                />
                <QBtn 
                  flat 
                  no-caps
                  color="primary" 
                  :label="t('tournamentBtnBack')" 
                  class="flat-back-btn q-ml-sm" 
                  @click="setupStep = 2" 
                />
              </QStepperNavigation>
            </QStep>

            
            <QStep
              :name="bracketStore.provider === 'startgg' ? 4 : 3"
              title="Ready"
              icon="check"
            >
              <div class="q-mb-md text-grey-4">
                You have selected the tournament. Import the players first, then pin it to start covering.
              </div>
              <QStepperNavigation>
                <QBtn
                  v-if="!playersImported"
                  unelevated
                  no-caps
                  color="primary"
                  icon="group_add"
                  :label="t('tournamentStepImportPlayers')"
                  class="primary-action-btn full-width q-mb-sm"
                  :loading="isImportingPlayers"
                  @click="onImportPlayersFirst"
                />
                <QBtn
                  v-else
                  unelevated
                  no-caps
                  disable
                  color="positive"
                  icon="check"
                  :label="t('tournamentStepPlayersImported')"
                  class="primary-action-btn full-width q-mb-sm"
                />
                <QBtn
                  unelevated
                  no-caps
                  color="primary"
                  icon="push_pin"
                  :label="t('tournamentStepPinFinish')"
                  class="primary-action-btn full-width"
                  :disable="!playersImported"
                  @click="onPinAndFinish"
                />
                <QBtn 
                  flat 
                  no-caps
                  color="primary" 
                  :label="t('tournamentBtnBack')" 
                  class="flat-back-btn q-mt-sm full-width" 
                  :disable="playersImported"
                  @click="setupStep = bracketStore.provider === 'startgg' ? 3 : 2" 
                />
              </QStepperNavigation>
            </QStep>
          </QStepper>
        </QCard>
      </div>

      
      <div class="col-12 col-md-8 col-lg-9">
        <QCard 
          flat 
          bordered 
          class="glass-panel matches-card"
        >
          <QCardSection>
            <div class="row items-center justify-between panel-header q-mb-md">
              <div class="text-h6 row items-center">
                {{ t('bracketMatches') }}
                <QIcon
                  v-if="viewMode === 'bracket'"
                  name="pan_tool"
                  color="grey-5"
                  size="sm"
                  class="q-ml-sm"
                >
                  <QTooltip class="glass-tooltip">
                    {{ t('tooltipDragToScroll') }}
                  </QTooltip>
                </QIcon>
              </div>
              <div class="row items-center q-gutter-md">
                <QBtnToggle
                  v-model="viewMode"
                  dense
                  unelevated
                  toggle-color="primary"
                  color="grey-9"
                  text-color="grey-4"
                  :options="[
                    { icon: 'grid_view', value: 'grid' },
                    { icon: 'account_tree', value: 'bracket' }
                  ]"
                />
                <QToggle
                  v-model="showOnlyPlayable"
                  :label="t('bracketPlayableOnly')"
                  dense
                  color="primary"
                />
                <QToggle
                  v-model="hideCompleted"
                  :label="t('bracketHideCompleted')"
                  dense
                  color="primary"
                />
                <QBtn 
                  v-if="bracketStore.provider === 'startgg' && bracketStore.startggGroupId" 
                  icon="refresh" 
                  flat 
                  round 
                  dense 
                  class="subtle-action-btn"
                  @click="bracketStore.fetchStartggSets(bracketStore.startggGroupId)" 
                >
                  <QTooltip class="glass-tooltip">
                    {{ t('tooltipRefreshMatches') }}
                  </QTooltip>
                </QBtn>
                <QBtn 
                  v-if="bracketStore.provider === 'challonge' && challonge.selectedTournamentSlug" 
                  icon="refresh" 
                  flat 
                  round 
                  dense 
                  class="subtle-action-btn"
                  @click="bracketStore.fetchChallongeMatches(challonge.selectedTournamentSlug)" 
                >
                  <QTooltip class="glass-tooltip">
                    {{ t('tooltipRefreshMatches') }}
                  </QTooltip>
                </QBtn>
              </div>
            </div>
            
            <div 
              v-if="bracketStore.loading" 
              class="row justify-center q-pa-xl"
            >
              <QSpinner 
                color="primary" 
                size="3em" 
              />
            </div>
            
            <div 
              v-else-if="!bracketStore.matches.length" 
              class="text-grey-6 q-pa-md text-center"
            >
              {{ t('bracketNoActiveMatches') }}
            </div>

            
            <div 
              v-if="viewMode === 'grid'" 
              class="match-grid-container q-mt-sm"
            >
              <div 
                v-for="match in gridMatches" 
                :key="match.id" 
                class="match-grid-wrapper"
              >
                <BracketMatchCard :match="match" />
              </div>
            </div>

            
            <div
              v-else-if="viewMode === 'bracket'"
              ref="bracketScrollContainer"
              class="bracket-view-container q-mt-sm overflow-auto"
              style="cursor: grab;"
              @mousedown="onBracketDragStart"
              @mousemove="onBracketDragMove"
              @mouseup="onBracketDragEnd"
              @mouseleave="onBracketDragEnd"
            >
              <div
                v-if="winnersMatchesByRound.length"
                class="bracket-tier q-mb-xl"
              >
                <div class="text-subtitle1 text-weight-bold text-primary q-mb-sm">
                  {{ t('bracketWinnersBracket') }}
                </div>
                <div class="row no-wrap bracket-row">
                  <div
                    v-for="(col, colIndex) in winnersMatchesByRound"
                    :key="col.round"
                    class="bracket-column column"
                  >
                    <div class="text-subtitle2 text-center text-grey-6">
                      {{ col.matches[0]?.fullRoundText }}
                    </div>
                    <div 
                      v-for="(match, index) in col.matches" 
                      :key="match.id" 
                      class="match-grid-wrapper"
                      :class="{
                        'connect-halve-top': (winnersMatchesByRound[colIndex + 1]?.matches.length ?? -1) === col.matches.length / 2 && index % 2 === 0,
                        'connect-halve-bottom': (winnersMatchesByRound[colIndex + 1]?.matches.length ?? -1) === col.matches.length / 2 && index % 2 !== 0,
                        'connect-straight': (winnersMatchesByRound[colIndex + 1]?.matches.length ?? -1) === col.matches.length,
                        'connect-left': colIndex > 0
                      }"
                    >
                      <BracketMatchCard
                        :match="match"
                        variant="bracket"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="losersMatchesByRound.length"
                class="bracket-tier"
              >
                <div class="text-subtitle1 text-weight-bold text-orange q-mb-sm">
                  {{ t('bracketLosersBracket') }}
                </div>
                <div class="row no-wrap bracket-row">
                  <div
                    v-for="(col, colIndex) in losersMatchesByRound"
                    :key="col.round"
                    class="bracket-column column"
                  >
                    <div class="text-subtitle2 text-center text-grey-6">
                      {{ col.matches[0]?.fullRoundText }}
                    </div>
                    <div 
                      v-for="(match, index) in col.matches" 
                      :key="match.id" 
                      class="match-grid-wrapper"
                      :class="{
                        'connect-halve-top': (losersMatchesByRound[colIndex + 1]?.matches.length ?? -1) === col.matches.length / 2 && index % 2 === 0,
                        'connect-halve-bottom': (losersMatchesByRound[colIndex + 1]?.matches.length ?? -1) === col.matches.length / 2 && index % 2 !== 0,
                        'connect-straight': (losersMatchesByRound[colIndex + 1]?.matches.length ?? -1) === col.matches.length,
                        'connect-left': colIndex > 0
                      }"
                    >
                      <BracketMatchCard
                        :match="match"
                        variant="bracket"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </QCardSection>
        </QCard>
      </div>
    </div>
  </QPage>
</template>

<style scoped lang="scss">
.bracket-page {
  padding: 64px 24px 24px 24px;
}
.matches-card {
  min-height: 400px;
}

.match-grid-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.sleek-select-btn {
  border: 1px solid var(--border-subtle);
  background: var(--bg-subtle);
  color: var(--text-base);
  border-radius: 4px;
  transition: all 0.2s ease;
  padding: 8px 12px;
  
  &:hover {
    border-color: var(--border-medium);
    background: rgba(255, 255, 255, 0.08);
  }
  
  &.active-selection {
    border-color: var(--q-primary);
    background: rgba(230, 107, 60, 0.15); 
    color: var(--q-primary);
  }

}
.match-grid-wrapper {
  width: 200px;
}

.match-grid-card {
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
  height: 100%;
}
.match-grid-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.match-card-top-border {
  height: 4px;
  width: 100%;
  background-color: var(--q-primary);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}
.match-players-box {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.03);
}
.body--light .match-players-box {
  border-color: rgba(0, 0, 0, 0.1);
  background-color: white;
}
.player-row {
  min-height: 32px;
}
.gamertag-text {
  max-width: 130px;
}
.score-text {
  font-weight: bold;
}
.report-popup-card {
  min-width: 320px;
  border-top: 4px solid var(--q-primary);
}
.score-btn {
  min-width: 28px;
  padding: 2px 4px;
  font-size: 12px;
}

.bracket-row {
  align-items: stretch;
}
.bracket-column {
  min-width: 220px;
  margin-right: 32px;
}
.bracket-column:last-child {
  margin-right: 0;
}
.bracket-view-container .match-grid-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  padding: 16px;
}

.connect-halve-top::after {
  content: "";
  position: absolute;
  top: 50%;
  right: -16px;
  height: 100%;
  width: 32px;
  border-top: 2px solid var(--q-primary);
  border-right: 2px solid var(--q-primary);
  border-top-right-radius: 4px;
}
.connect-halve-bottom::after {
  content: "";
  position: absolute;
  bottom: 50%;
  right: -16px;
  height: 100%;
  width: 32px;
  border-bottom: 2px solid var(--q-primary);
  border-right: 2px solid var(--q-primary);
  border-bottom-right-radius: 4px;
}
.connect-straight::after {
  content: "";
  position: absolute;
  top: 50%;
  right: -16px;
  width: 32px;
  border-top: 2px solid var(--q-primary);
}
.connect-left::before {
  content: "";
  position: absolute;
  top: 50%;
  left: -16px;
  width: 32px;
  border-top: 2px solid var(--q-primary);
}
</style>
