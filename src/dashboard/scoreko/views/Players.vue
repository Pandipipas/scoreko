<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getCountryLabel, getCountryOptions } from '../../../shared/countries';
import type { Schemas } from '../../../types';
import challongeIcoUrl from '../assets/challonge.ico';
import startggSvgUrl from '../assets/startgg.svg';
import { useIntegration } from '../composables/useIntegration';
import { locale, t } from '../i18n';
import { usePlayersStore } from '../stores/players';
import { TEMP_FALLBACK_DURATION_SECONDS, LS_KEYS } from '../../../shared/constants';

defineOptions({ name: 'PlayersView' });

useHead(() => ({ title: t('menuPlayers') }));

type PlayersMap = Schemas.Players;
type Player = PlayersMap[string];

interface PlayerRow extends Player {
  id: string;
}

const STARTGG_TEMP_PLAYERS_STORAGE_KEY = LS_KEYS.STARTGG_TEMP_PLAYERS;
const CHALLONGE_TEMP_PLAYERS_STORAGE_KEY = LS_KEYS.CHALLONGE_TEMP_PLAYERS;

const playersStore = usePlayersStore();
const $q = useQuasar();
const router = useRouter();
const rows = computed<PlayerRow[]>(() => playersStore.rows);

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
  on401Message:
    'Challonge rejected the token (401 Unauthorized). Re-connect OAuth so it grants scopes (me, tournaments:read, participants:read) or paste a valid personal API token.',
  playersStore,
});

watch(() => startgg.importDialogError, (msg) => {
  if (msg) $q.notify({ type: 'negative', message: msg });
});
watch(() => challonge.importDialogError, (msg) => {
  if (msg) $q.notify({ type: 'negative', message: msg });
});

const playerSource = (id: string): 'startgg' | 'challonge' | null => {
  if (id in startgg.temporaryPlayers) return 'startgg';
  if (id in challonge.temporaryPlayers) return 'challonge';
  return null;
};

const playerExpiresAt = (id: string): number | null =>
  startgg.temporaryPlayers[id]?.expiresAt ?? challonge.temporaryPlayers[id]?.expiresAt ?? null;

const formatExpiresAt = (ts: number): string =>
  new Date(ts * 1000).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const filter = ref('');

const columns = computed<QTableColumn<PlayerRow>[]>(() => [
  { name: 'gamertag', label: 'Gamertag', field: 'gamertag', sortable: true, align: 'left' },
  { name: 'team', label: t('playersLabelTeam'), field: 'team', sortable: true, align: 'left' },
  {
    name: 'country',
    label: t('playersLabelCountry'),
    field: (row) => getCountryLabel(row.country, locale.value),
    sortable: true,
    align: 'left',
  },
  { name: 'twitter', label: 'Twitter', field: 'twitter', sortable: true, align: 'left' },
  { name: 'actions', label: t('playersLabelActions'), field: (row) => row.id, sortable: false, align: 'right' },
]);

const countryOptions = computed(() => getCountryOptions(locale.value));
const filteredCountryOptions = ref(countryOptions.value);
const countryInput = ref('');

const filterCountries = (value: string, update: (cb: () => void) => void) => {
  update(() => {
    const needle = value.toLowerCase().trim();
    filteredCountryOptions.value = needle
      ? countryOptions.value.filter((c) => c.label.toLowerCase().includes(needle))
      : countryOptions.value;
  });
};

watch(countryOptions, (value) => {
  filteredCountryOptions.value = value;
});

const emptyPlayer: Player = { gamertag: '', name: '', country: '', team: '', twitter: '' };
const form = reactive<Player>({ ...emptyPlayer });
const isDialogOpen = ref(false);
const editingId = ref<string | null>(null);

watch(
  () => form.country,
  (value) => { countryInput.value = getCountryLabel(value, locale.value); },
  { immediate: true },
);

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const openCreateDialog = () => {
  editingId.value = null;
  Object.assign(form, emptyPlayer);
  isDialogOpen.value = true;
};

const openEditDialog = (row: PlayerRow) => {
  editingId.value = row.id;
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...playerData } = row;
  Object.assign(form, playerData);
  isDialogOpen.value = true;
};

const savePlayer = () => {
  playersStore.upsertPlayer(editingId.value ?? generateId(), { ...form });
  isDialogOpen.value = false;
};

const confirmingDeleteId = ref<string | null>(null);
let deleteTimeout: ReturnType<typeof setTimeout> | null = null;

const requestDeletePlayer = (row: PlayerRow) => {
  if (confirmingDeleteId.value === row.id) {
    playersStore.removePlayer(row.id);
    confirmingDeleteId.value = null;
    if (deleteTimeout) clearTimeout(deleteTimeout);
  } else {
    confirmingDeleteId.value = row.id;
    if (deleteTimeout) clearTimeout(deleteTimeout);
    deleteTimeout = setTimeout(() => {
      if (confirmingDeleteId.value === row.id) {
        confirmingDeleteId.value = null;
      }
    }, 3000);
  }
};

const fileInput = ref<HTMLInputElement | null>(null);

const exportPlayers = () => {
  const data = JSON.stringify(playersStore.players, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'players.json';
  link.click();
  URL.revokeObjectURL(url);
};

const setupStep = ref(1);
const provider = ref<'startgg' | 'challonge' | null>(null);

const setProvider = (prov: 'startgg' | 'challonge') => {
  provider.value = prov;
  manualUrl.value = '';
  showAdvancedSearch.value = false;
};

const showAdvancedSearch = ref(false);

const onContinueStep1 = () => {
  if (!provider.value) {
    $q.notify({ type: 'warning', message: `${t('bracketProvider')} is required.` });
    return;
  }
  if (provider.value === 'startgg' && !startgg.hasTokenConfigured) {
    $q.notify({
      type: 'negative',
      message: t('playersStartggNotConnected'),
      actions: [{ label: t('menuSettings'), color: 'white', handler: () => { router.push('/settings#integrations'); } }]
    });
    return;
  }
  if (provider.value === 'challonge' && !challonge.hasTokenConfigured) {
    $q.notify({
      type: 'negative',
      message: t('playersChallongeNotConnected'),
      actions: [{ label: t('menuSettings'), color: 'white', handler: () => { router.push('/settings#integrations'); } }]
    });
    return;
  }
  setupStep.value = 2;
};

const onContinueStep2 = () => {
  if (provider.value === 'startgg' && !startgg.selectedTournamentSlug) {
    $q.notify({ type: 'warning', message: t('playersSelectTournamentFirst') });
    return;
  }
  if (provider.value === 'challonge' && !challonge.selectedTournamentSlug) {
    $q.notify({ type: 'warning', message: t('playersSelectTournamentFirst') });
    return;
  }
  if (provider.value === 'startgg') {
    startgg.openSelectedTournamentImportDialog();
  } else {
    challonge.openSelectedTournamentImportDialog();
  }
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
    if (provider.value === 'startgg') startgg.selectedTournamentSlug = '';
    if (provider.value === 'challonge') challonge.selectedTournamentSlug = '';
    return;
  }
  
  const strVal = String(val).trim();
  if (provider.value === 'startgg') {
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

const triggerImport = () => { fileInput.value?.click(); };

const handleImport = async (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    playersStore.setPlayers(parsed as PlayersMap);
  } catch {
    $q.notify({ type: 'negative', message: t('playersImportJsonError') });
  } finally {
    if (target) target.value = '';
  }
};
</script>

<template>
  <QPage class="players-page">
    <div class="players-content row q-col-gutter-md">
      <div class="col-12 col-md-4 col-lg-3 players-import-column">
        <QCard 
          flat 
          bordered 
          class="glass-panel"
        >
          <div class="q-pa-md q-pb-none">
            <div class="text-subtitle1 text-weight-bold text-primary">
              <QIcon
                name="group_add"
                size="sm"
                class="q-mr-xs"
              />
              {{ t('playersImportPlayers') }}
            </div>
            <div class="text-caption text-grey-5">
              Connect to a tournament to import its participants.
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
                  :class="{ 'active-selection': provider === 'startgg' }"
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
                  :class="{ 'active-selection': provider === 'challonge' }"
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
                v-if="provider === 'startgg'"
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
                        <span>
                          {{ tourn.label }}
                        </span>
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
                v-if="provider === 'challonge'"
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
                        <span>
                          {{ tourn.label }}
                        </span>
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

              <QStepperNavigation>
                <QBtn 
                  unelevated
                  no-caps
                  color="primary" 
                  label="Select Players" 
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
          </QStepper>
        </QCard>
      </div>
      <div class="col-12 col-md-8 col-lg-9 players-main-column">
        <QTable
          class="glass-panel"
          row-key="id"
          :rows="rows"
          :columns="columns"
          :filter="filter"
          :rows-per-page-options="[10, 20, 50]"
        >
          <template #top>
            <div
              class="row items-center full-width"
              style="gap: 12px;"
            >
              <QBtn
                unelevated
                color="primary"
                icon="add"
                no-caps
                class="primary-action-btn"
                :label="t('playersNewPlayer')"
                @click="openCreateDialog"
              />
              <QBtn
                color="secondary"
                outline
                icon="file_upload"
                no-caps
                class="flat-back-btn"
                :label="t('playersImport')"
                @click="triggerImport"
              />
              <QBtn
                color="secondary"
                outline
                icon="file_download"
                no-caps
                class="flat-back-btn"
                :label="t('playersExport')"
                @click="exportPlayers"
              />
              <input
                ref="fileInput"
                type="file"
                class="visually-hidden"
                accept="application/json"
                @change="handleImport"
              >
              <QSpace />
              <span
                class="text-caption"
                style="color: var(--text-muted)"
              >
                {{ rows.length }} players
              </span>
              <QInput
                v-model="filter"
                dense
                :placeholder="t('playersSearchPlaceholder')"
                class="players-search underlined-field"
                clearable
              >
                <template #prepend>
                  <QIcon name="search" />
                </template>
              </QInput>
            </div>
          </template>
          <template #body-cell-gamertag="{ row }">
            <QTd>
              <div class="row items-center q-gutter-x-sm">
                <span class="text-weight-medium">{{ row.gamertag }}</span>
                <QChip
                  v-if="playerSource(row.id) === 'startgg'"
                  dense
                  class="q-my-none q-mr-none q-ml-xs players-source-chip"
                >
                  <img
                    :src="startggSvgUrl"
                    alt="start.gg"
                    style="width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0;"
                  >
                  <QTooltip>
                    start.gg<template v-if="playerExpiresAt(row.id)">
                      · {{ t('playersTemporary') }} · {{ t('playersExpires').replace('{date}', formatExpiresAt(playerExpiresAt(row.id)!)) }}
                    </template>
                  </QTooltip>
                </QChip>
                <QChip
                  v-else-if="playerSource(row.id) === 'challonge'"
                  dense
                  class="q-my-none q-mr-none q-ml-xs players-source-chip"
                >
                  <img
                    :src="challongeIcoUrl"
                    alt="Challonge"
                    style="width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0;"
                  >
                  <QTooltip>
                    Challonge<template v-if="playerExpiresAt(row.id)">
                      · {{ t('playersTemporary') }} · {{ t('playersExpires').replace('{date}', formatExpiresAt(playerExpiresAt(row.id)!)) }}
                    </template>
                  </QTooltip>
                </QChip>
              </div>
              <div
                v-if="row.name"
                class="text-caption"
                style="color: var(--text-muted)"
              >
                {{ row.name }}
              </div>
            </QTd>
          </template>
          <template #body-cell-actions="{ row }">
            <QTd align="right">
              <QBtn
                size="sm"
                flat
                icon="edit"
                class="subtle-action-btn"
                @click="openEditDialog(row)"
              />
              <QBtn
                size="sm"
                flat
                color="negative"
                :icon="confirmingDeleteId === row.id ? 'warning' : 'delete'"
                :label="confirmingDeleteId === row.id ? t('playersDeleteSure') : ''"
                class="subtle-action-btn transition-all"
                :class="{ 'q-px-sm': confirmingDeleteId === row.id }"
                @click="requestDeletePlayer(row)"
              />
            </QTd>
          </template>
        </QTable>
      </div>
    </div>
    <QDialog
      v-model="startgg.importDialogOpen"
      backdrop-filter="blur(4px) brightness(60%)"
    >
      <QCard class="players-dialog glass-panel">
        <QCardSection>
          <div class="text-h6 panel-header">
            Import from {{ startgg.importingTournament?.name || 'start.gg' }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection>
          <div
            v-if="startgg.loadingPlayers"
            class="row items-center q-gutter-sm"
          >
            <QSpinner />
            <span>{{ t('playersLoadingParticipants') }}</span>
          </div>
          <div v-else>
            <div class="row q-gutter-sm q-mb-sm">
              <QBtn
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                :label="startgg.selectedPlayerIds.length === startgg.players.length ? 'Deselect all' : 'Select all'"
                @click="startgg.toggleAllPlayers"
              />
              <span
                class="text-caption self-center"
                style="color: var(--text-muted)"
              >
                {{ startgg.selectedPlayerIds.length }} / {{ startgg.players.length }} selected
              </span>
            </div>
            <QOptionGroup
              v-model="startgg.selectedPlayerIds"
              type="checkbox"
              :options="startgg.players.map((player) => ({
                label: `${player.gamertag}${player.team ? ` (${player.team})` : ''}${player.country ? ` - ${getCountryLabel(player.country, locale)}` : ''}`,
                value: player.id,
              }))"
            />
          </div>
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            flat
            no-caps
            label="Cancel"
            color="secondary"
            class="flat-back-btn"
            @click="startgg.importDialogOpen = false"
          />
          <QBtn
            unelevated
            no-caps
            color="primary"
            label="Import selected"
            class="primary-action-btn"
            :disable="!startgg.selectedPlayerIds.length"
            @click="startgg.importSelectedPlayers"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog
      v-model="challonge.importDialogOpen"
      backdrop-filter="blur(4px) brightness(60%)"
    >
      <QCard class="players-dialog glass-panel">
        <QCardSection>
          <div class="text-h6 panel-header">
            Import from {{ challonge.importingTournament?.name || 'Challonge' }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection>
          <div
            v-if="challonge.loadingPlayers"
            class="row items-center q-gutter-sm"
          >
            <QSpinner />
            <span>{{ t('playersLoadingParticipants') }}</span>
          </div>
          <div v-else>
            <div class="row q-gutter-sm q-mb-sm">
              <QBtn
                flat
                dense
                no-caps
                size="sm"
                color="primary"
                :label="challonge.selectedPlayerIds.length === challonge.players.length ? 'Deselect all' : 'Select all'"
                @click="challonge.toggleAllPlayers"
              />
              <span
                class="text-caption self-center"
                style="color: var(--text-muted)"
              >
                {{ challonge.selectedPlayerIds.length }} / {{ challonge.players.length }} selected
              </span>
            </div>
            <QOptionGroup
              v-model="challonge.selectedPlayerIds"
              type="checkbox"
              :options="challonge.players.map((player) => ({
                label: `${player.gamertag}${player.team ? ` (${player.team})` : ''}`,
                value: player.id,
              }))"
            />
          </div>
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            flat
            no-caps
            label="Cancel"
            color="secondary"
            class="flat-back-btn"
            @click="challonge.importDialogOpen = false"
          />
          <QBtn
            unelevated
            no-caps
            color="primary"
            label="Import selected"
            class="primary-action-btn"
            :disable="!challonge.selectedPlayerIds.length"
            @click="challonge.importSelectedPlayers"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog
      v-model="isDialogOpen"
      backdrop-filter="blur(4px) brightness(60%)"
    >
      <QCard class="players-dialog glass-panel">
        <QCardSection>
          <div class="text-h6 panel-header">
            {{ editingId ? 'Edit player' : t('playersNewPlayer') }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection>
          <QForm @submit.prevent="savePlayer">
            <div class="row q-col-gutter-md">
              <div class="col-12">
                <QInput
                  v-model="form.gamertag"
                  label="Gamertag"
                  dense
                  class="underlined-field"
                  autofocus
                  :rules="[(val) => !!val || t('playersGamertagRequired')]"
                  lazy-rules
                />
              </div>
              <div class="col-12">
                <QInput
                  v-model="form.name"
                  label="Name"
                  dense
                  class="underlined-field"
                />
              </div>
              <div class="col-12">
                <QSelect
                  v-model="form.country"
                  v-model:input-value="countryInput"
                  :options="filteredCountryOptions"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  use-input
                  input-debounce="0"
                  hide-selected
                  fill-input
                  clearable
                  :label="t('playersLabelCountry')"
                  dense
                  options-dense
                  color="primary"
                  popup-content-class="glass-panel glass-dropdown"
                  class="underlined-field"
                  @filter="filterCountries"
                />
              </div>
              <div class="col-12">
                <QInput
                  v-model="form.team"
                  :label="t('playersLabelTeam')"
                  dense
                  class="underlined-field"
                />
              </div>
              <div class="col-12">
                <QInput
                  v-model="form.twitter"
                  label="Twitter"
                  dense
                  class="underlined-field"
                />
              </div>
            </div>
          </QForm>
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            flat
            no-caps
            label="Cancel"
            color="secondary"
            class="flat-back-btn"
            @click="isDialogOpen = false"
          />
          <QBtn
            unelevated
            no-caps
            color="primary"
            label="Save"
            class="primary-action-btn"
            @click="savePlayer"
          />
        </QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>

<style scoped lang="scss">
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

.players-page {
  padding: 64px 24px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.players-search {
  min-width: 240px;
}

.players-content {
  align-items: flex-start;
}

.players-main-column {
  min-width: 0;
  flex: 1 1 auto;
}

.players-import-column {
  min-width: 300px;
}

.players-integrations-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.players-dialog {
  min-width: 320px;
  width: min(720px, 90vw);
}

.players-tournament-row {
  gap: 4px;
}

.players-source-chip {
  height: 18px;
  padding: 0 4px;
  background: transparent;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
