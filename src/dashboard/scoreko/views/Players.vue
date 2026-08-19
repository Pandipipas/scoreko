<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getCountryLabel, getCountryOptions } from '../../../shared/countries';
import type { Schemas } from '../../../types';
import challongeIcoUrl from '../assets/challonge.ico';
import startggSvgUrl from '../assets/startgg.svg';
import twitchSvgUrl from '../assets/twitch.svg';
import { useIntegration } from '../composables/useIntegration';
import { locale, t } from '../i18n';
import { usePlayersStore } from '../stores/players';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { TEMP_FALLBACK_DURATION_SECONDS, LS_KEYS } from '../../../shared/constants';
import { getFlagSvgUrl } from '../util/flags';

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
const { confirmAction } = useConfirmDialog();

const selectedRows = ref<PlayerRow[]>([]);

const textFilter = ref('');

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

const playerSources = (id: string): ('startgg' | 'challonge')[] => {
  const sources: ('startgg' | 'challonge')[] = [];
  if (startgg.temporaryPlayers[id] || playersStore.players[id]?.startggId) {
    sources.push('startgg');
  }
  if (challonge.temporaryPlayers[id] || playersStore.players[id]?.challongeId) {
    sources.push('challonge');
  }
  return sources;
};

const isTemporary = (id: string): boolean => {
  return (id in startgg.temporaryPlayers) || (id in challonge.temporaryPlayers);
};

const playerExpiresAt = (id: string, source: 'startgg' | 'challonge'): number | null => {
  if (source === 'startgg') {
    return startgg.temporaryPlayers[id]?.expiresAt || null;
  }
  return challonge.temporaryPlayers[id]?.expiresAt || null;
};

const formatExpiresAt = (ts: number): string =>
  new Date(ts * 1000).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const filteredRows = computed<PlayerRow[]>(() => {
  return playersStore.rows.filter((row) => {


    if (!textFilter.value.trim()) return true;
    const q = textFilter.value.toLowerCase().trim();
    return (
      row.gamertag.toLowerCase().includes(q) ||
      row.name.toLowerCase().includes(q) ||
      row.team.toLowerCase().includes(q) ||
      row.twitter.toLowerCase().includes(q) ||
      (row.twitch && row.twitch.toLowerCase().includes(q)) ||
      (row.country && getCountryLabel(row.country, locale.value).toLowerCase().includes(q))
    );
  });
});

const columns = computed<QTableColumn<PlayerRow>[]>(() => [
  { name: 'gamertag', label: 'Gamertag / Player', field: 'gamertag', sortable: true, align: 'left' },
  { name: 'team', label: t('playersLabelTeam'), field: 'team', sortable: true, align: 'left' },
  {
    name: 'country',
    label: t('playersLabelCountry'),
    field: (row) => getCountryLabel(row.country, locale.value),
    sortable: true,
    align: 'left',
  },
  { name: 'socials', label: 'Socials', field: 'twitter', sortable: false, align: 'left' },
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

const emptyPlayer: Player = {
  gamertag: '',
  name: '',
  country: '',
  team: '',
  twitter: '',
  twitch: '',
  avatarUrl: '',
  startggId: '',
  challongeId: '',
};

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

const requestDeletePlayer = async (row: PlayerRow) => {
  const confirmed = await confirmAction({
    title: t('playersDeleteSure'),
    message: t('playersDeleteConfirm').replace('{name}', row.gamertag || t('playersDeleteFallback')),
    destructive: true
  });
  if (!confirmed) return;

  playersStore.removePlayer(row.id);
  selectedRows.value = selectedRows.value.filter(r => r.id !== row.id);
};

const promoteSinglePlayer = (id: string) => {
  playersStore.promoteToPermanent([id]);
  $q.notify({ type: 'positive', message: 'Player converted to permanent.' });
};

const bulkPromoteSelected = () => {
  const ids = selectedRows.value.map(r => r.id);
  playersStore.promoteToPermanent(ids);
  $q.notify({ type: 'positive', message: `${ids.length} players converted to permanent.` });
  selectedRows.value = [];
};

const isBulkTeamDialogOpen = ref(false);
const bulkTeamInput = ref('');

const openBulkTeamDialog = () => {
  bulkTeamInput.value = '';
  isBulkTeamDialogOpen.value = true;
};

const saveBulkTeam = () => {
  const ids = selectedRows.value.map(r => r.id);
  playersStore.bulkSetTeam(ids, bulkTeamInput.value.trim());
  $q.notify({ type: 'positive', message: `Team updated for ${ids.length} players.` });
  isBulkTeamDialogOpen.value = false;
  selectedRows.value = [];
};

const requestBulkDelete = async () => {
  const count = selectedRows.value.length;
  const confirmed = await confirmAction({
    title: t('playersBulkDelete'),
    message: t('playersBulkDeleteSure').replace('{count}', String(count)),
    destructive: true
  });
  if (!confirmed) return;

  playersStore.bulkRemovePlayers(selectedRows.value.map(r => r.id));
  selectedRows.value = [];
};

interface DuplicateGroup {
  normalizedTag: string;
  primaryId: string;
  candidates: PlayerRow[];
}

const isMergeDialogOpen = ref(false);

const detectedDuplicateGroups = computed<DuplicateGroup[]>(() => {
  const groupsMap = new Map<string, PlayerRow[]>();

  playersStore.rows.forEach((p) => {
    let cleanTag = p.gamertag.toLowerCase().trim();
    if (cleanTag.includes('|')) {
      cleanTag = cleanTag.split('|').pop()?.trim() || cleanTag;
    }
    cleanTag = cleanTag.replace(/[^a-z0-9]/g, '');
    if (!cleanTag) return;

    if (!groupsMap.has(cleanTag)) {
      groupsMap.set(cleanTag, []);
    }
    groupsMap.get(cleanTag)!.push(p);
  });

  const res: DuplicateGroup[] = [];
  groupsMap.forEach((candidates, norm) => {
    if (candidates.length >= 2) {
      res.push({
        normalizedTag: norm,
        primaryId: candidates[0]?.id || '',
        candidates,
      });
    }
  });
  return res;
});

const executeMerge = (group: DuplicateGroup) => {
  const sourceIds = group.candidates.filter((c) => c.id !== group.primaryId).map((c) => c.id);
  playersStore.mergePlayers(group.primaryId, sourceIds);
  if (detectedDuplicateGroups.value.length <= 1) {
    isMergeDialogOpen.value = false;
  }
  $q.notify({ type: 'positive', message: 'Players merged successfully.' });
};



const fileInput = ref<HTMLInputElement | null>(null);
const backupStep = ref(1);
const backupAction = ref<'export' | 'import'>('export');
const backupFormat = ref<'json' | 'csv'>('json');

const exportPlayersJSON = () => {
  const data = JSON.stringify(playersStore.players, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'players_export.json';
  link.click();
  URL.revokeObjectURL(url);
};

const exportPlayersCSV = () => {
  const headers = ['ID', 'Gamertag', 'Name', 'Team', 'Country', 'Twitter', 'Twitch', 'AvatarUrl', 'StartggId', 'ChallongeId'];
  const rowsData = playersStore.rows.map(p => [
    p.id,
    p.gamertag,
    p.name,
    p.team,
    p.country,
    p.twitter,
    p.twitch || '',
    p.avatarUrl || '',
    p.startggId || '',
    p.challongeId || '',
  ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
  const csvContent = [headers.join(','), ...rowsData].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'players_export.csv';
  link.click();
  URL.revokeObjectURL(url);
};

const triggerImport = () => { fileInput.value?.click(); };

const handleImport = async (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    if (file.name.endsWith('.csv')) {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const nextMap: PlayersMap = {};
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i]?.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(p => p.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
          if (parts.length >= 2) {
            const pid = parts[0] || generateId();
            nextMap[pid] = {
              gamertag: parts[1] || '',
              name: parts[2] || '',
              team: parts[3] || '',
              country: parts[4] || '',
              twitter: parts[5] || '',
              twitch: parts[6] || '',
              avatarUrl: parts[7] || '',
              startggId: parts[8] || '',
              challongeId: parts[9] || '',
            };
          }
        }
        playersStore.setPlayers(nextMap);
      }
    } else {
      const parsed = JSON.parse(text) as unknown;
      playersStore.setPlayers(parsed as PlayersMap);
    }
    $q.notify({ type: 'positive', message: 'Database imported successfully!' });
    backupStep.value = 1;
  } catch {
    $q.notify({ type: 'negative', message: t('playersImportJsonError') });
  } finally {
    if (target) target.value = '';
  }
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
    $q.notify({ type: 'warning', message: t('tournamentProviderRequired') });
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
  isImportSetupDialogOpen.value = false;
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

const isImportSetupDialogOpen = ref(false);
const isBackupDialogOpen = ref(false);
</script>

<template>
  <QPage class="q-px-lg q-pb-lg players-page">
    <div class="players-content">
      <!-- IMPORT TOURNAMENT MODAL -->
      <QDialog
        v-model="isImportSetupDialogOpen"
        backdrop-filter="blur(4px) brightness(60%)"
      >
        <!-- CARD 1: TOURNAMENT PARTICIPANT IMPORT -->
        <QCard
          flat
          bordered
          class="glass-panel"
        >
          <div class="q-pa-md q-pb-none">
            <div class="text-subtitle1 text-weight-bold panel-header row items-center">
              <QIcon
                name="emoji_events"
                size="sm"
                class="q-mr-xs text-primary"
              />
              {{ t('playersTournamentImportHeader') }}
            </div>
            <div class="text-caption text-grey-5 q-mt-xs">
              {{ t('playersTournamentImportSubtitle') }}
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
              icon="cloud"
              :done="setupStep > 1"
            >
              <div class="row q-gutter-sm">
                <QBtn
                  flat
                  no-caps
                  class="sleek-select-btn col"
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
                  class="sleek-select-btn col"
                  :class="{ 'active-selection': provider === 'challonge' }"
                  @click="setProvider('challonge')"
                >
                  <img
                    :src="challongeIcoUrl"
                    alt="Challonge"
                    style="width: 16px; height: 16px; margin-right: 8px; transform: scale(1.15);"
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
              icon="emoji_events"
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
      </QDialog>


      <!-- EXPORT & IMPORT MODAL -->
      <QDialog
        v-model="isBackupDialogOpen"
        backdrop-filter="blur(4px) brightness(60%)"
      >
        <QCard
          flat
          bordered
          class="glass-panel q-pa-md"
        >
          <div class="text-subtitle1 text-weight-bold panel-header row items-center">
            <QIcon
              name="import_export"
              size="sm"
              class="q-mr-xs text-primary"
            />
            {{ t('playersBackupHeader') }}
          </div>
          <div class="text-caption text-grey-5 q-mt-xs q-mb-md">
            {{ t('playersBackupSubtitle') }}
          </div>

          <QStepper
            v-model="backupStep"
            vertical
            color="primary"
            animated
            flat
            class="transparent-stepper no-padding"
          >
            <QStep
              :name="1"
              title="1. Select Operation"
              icon="import_export"
              :done="backupStep > 1"
            >
              <div class="row q-gutter-x-sm">
                <QBtn
                  flat
                  no-caps
                  class="sleek-select-btn col"
                  :class="{ 'active-selection': backupAction === 'export' }"
                  @click="backupAction = 'export'"
                >
                  <QIcon
                    name="file_download"
                    class="q-mr-xs"
                    size="xs"
                  />
                  Export
                </QBtn>
                <QBtn
                  flat
                  no-caps
                  class="sleek-select-btn col"
                  :class="{ 'active-selection': backupAction === 'import' }"
                  @click="backupAction = 'import'"
                >
                  <QIcon
                    name="file_upload"
                    class="q-mr-xs"
                    size="xs"
                  />
                  Import
                </QBtn>
              </div>
              <QStepperNavigation>
                <QBtn
                  unelevated
                  no-caps
                  color="primary"
                  label="Continue"
                  class="primary-action-btn"
                  @click="backupStep = 2"
                />
              </QStepperNavigation>
            </QStep>

            <QStep
              :name="2"
              :title="backupAction === 'export' ? '2. Select Format' : '2. Select File'"
              icon="source"
              :done="backupStep > 2"
            >
              <template v-if="backupAction === 'export'">
                <div class="row q-gutter-x-sm q-mb-sm">
                  <QBtn
                    flat
                    no-caps
                    class="sleek-select-btn col"
                    :class="{ 'active-selection': backupFormat === 'json' }"
                    @click="backupFormat = 'json'"
                  >
                    JSON
                  </QBtn>
                  <QBtn
                    flat
                    no-caps
                    class="sleek-select-btn col"
                    :class="{ 'active-selection': backupFormat === 'csv' }"
                    @click="backupFormat = 'csv'"
                  >
                    CSV
                  </QBtn>
                </div>
                <QStepperNavigation>
                  <QBtn
                    unelevated
                    no-caps
                    color="primary"
                    label="Download"
                    class="primary-action-btn q-mr-sm"
                    icon="file_download"
                    @click="backupFormat === 'json' ? exportPlayersJSON() : exportPlayersCSV()"
                  />
                  <QBtn
                    flat
                    no-caps
                    color="primary"
                    label="Back"
                    class="flat-back-btn"
                    @click="backupStep = 1"
                  />
                </QStepperNavigation>
              </template>
              
              <template v-else>
                <QBtn
                  color="secondary"
                  unelevated
                  icon="file_upload"
                  no-caps
                  class="primary-action-btn full-width q-mb-sm"
                  label="Import Database (JSON/CSV)"
                  @click="triggerImport"
                />
                <input
                  ref="fileInput"
                  type="file"
                  accept=".json,.csv"
                  class="hidden"
                  @change="handleImport"
                >
                <QStepperNavigation>
                  <QBtn
                    flat
                    no-caps
                    color="primary"
                    label="Back"
                    class="flat-back-btn"
                    @click="backupStep = 1"
                  />
                </QStepperNavigation>
              </template>
            </QStep>
          </QStepper>
        </QCard>
      </QDialog>

      <!-- MAIN COLUMN: PLAYERS TABLE -->
      <div class="col-12 players-main-column">
        <!-- AUTOMATIC DUPLICATE DETECTED BANNER -->
        <Transition name="slide-fade">
          <div
            v-if="detectedDuplicateGroups.length > 0"
            class="glass-panel q-pa-sm q-px-md row items-center justify-between q-mb-md duplicate-detected-bar"
          >
            <div class="row items-center q-gutter-x-sm text-warning">
              <QIcon
                name="merge_type"
                size="sm"
              />
              <span class="text-weight-bold text-subtitle2">
                {{ t('playersDuplicatesDetected').replace('{count}', String(detectedDuplicateGroups.length)) }}
              </span>
            </div>
            <QBtn
              flat
              dense
              no-caps
              size="sm"
              color="warning"
              icon="launch"
              :label="t('playersReviewDuplicates')"
              @click="isMergeDialogOpen = true"
            />
          </div>
        </Transition>

        <!-- BULK SELECTION GLASS BANNER -->
        <Transition name="slide-fade">
          <div
            v-if="selectedRows.length > 0"
            class="glass-panel q-pa-sm q-px-md row items-center justify-between q-mb-md bulk-selection-bar"
          >
            <div class="row items-center q-gutter-x-sm">
              <QIcon
                name="checklist"
                color="primary"
                size="sm"
              />
              <span class="text-weight-bold text-primary text-subtitle2">
                {{ t('playersBulkSelected').replace('{count}', String(selectedRows.length)) }}
              </span>
            </div>
            <div class="row items-center q-gutter-x-xs">
              <QBtn
                flat
                dense
                no-caps
                icon="star"
                color="primary"
                :label="t('playersBulkPromote')"
                @click="bulkPromoteSelected"
              />
              <QBtn
                flat
                dense
                no-caps
                icon="badge"
                color="secondary"
                :label="t('playersBulkSetTeam')"
                @click="openBulkTeamDialog"
              />
              <QBtn
                flat
                dense
                no-caps
                icon="delete"
                color="negative"
                :label="t('playersBulkDelete')"
                @click="requestBulkDelete"
              />
            </div>
          </div>
        </Transition>

        <QTable
          v-model:selected="selectedRows"
          class="glass-panel dashboard-stagger-1"
          row-key="id"
          selection="multiple"
          :rows="filteredRows"
          :columns="columns"
          :rows-per-page-options="[10, 20, 50]"
          :rows-per-page-label="t('playersRecordsPerPage')"
          :pagination-label="(firstRowIndex, endRowIndex, totalRowsNumber) => t('playersPaginationLabel').replace('{first}', String(firstRowIndex)).replace('{last}', String(endRowIndex)).replace('{total}', String(totalRowsNumber))"
        >
          <template #top>
            <div
              class="row items-center full-width wrap q-gutter-y-sm"
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
                flat
                color="secondary"
                icon="emoji_events"
                no-caps
                class="sleek-select-btn"
                :label="t('playersImportPlayers')"
                @click="isImportSetupDialogOpen = true"
              />

              <QBtn
                flat
                color="secondary"
                icon="storage"
                no-caps
                class="sleek-select-btn"
                :label="t('playersBackupHeader')"
                @click="isBackupDialogOpen = true"
              />

              <QSpace />

              <QInput
                v-model="textFilter"
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



          <!-- GAMERTAG CELL -->
          <template #body-cell-gamertag="{ row }">
            <QTd>
              <div class="row items-center q-gutter-x-sm">
                <!-- AVATAR THUMBNAIL -->
                <QAvatar
                  size="28px"
                  class="bg-grey-8 text-white"
                >
                  <img
                    v-if="row.avatarUrl"
                    :src="row.avatarUrl"
                    alt="Avatar"
                  >
                  <span
                    v-else
                    class="text-weight-bold text-caption"
                  >
                    {{ (row.gamertag[0] || 'P').toUpperCase() }}
                  </span>
                </QAvatar>

                <div class="column">
                  <div class="row items-center q-gutter-x-xs">
                    <span class="text-weight-medium text-subtitle2">{{ row.gamertag }}</span>

                    <!-- ORIGIN CHIPS -->
                    <QChip
                      v-if="row.startggId"
                      dense
                      class="q-my-none q-mr-none q-ml-xs players-source-chip"
                    >
                      <QIcon
                        v-if="playerSources(row.id).includes('startgg') && playerExpiresAt(row.id, 'startgg')"
                        name="schedule"
                        size="10px"
                        class="q-mr-xs text-grey-5"
                      />
                      <img
                        :src="startggSvgUrl"
                        alt="start.gg"
                        style="width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0;"
                      >
                      <QTooltip>
                        start.gg
                        <span v-if="playerSources(row.id).includes('startgg') && playerExpiresAt(row.id, 'startgg')">
                          · {{ t('playersTemporary') }} · {{ t('playersExpires').replace('{date}', formatExpiresAt(playerExpiresAt(row.id, 'startgg')!)) }}
                        </span>
                      </QTooltip>
                    </QChip>

                    <QChip
                      v-if="playerSources(row.id).includes('challonge')"
                      dense
                      class="q-my-none q-mr-none q-ml-xs players-source-chip"
                    >
                      <QIcon
                        v-if="playerSources(row.id).includes('challonge') && playerExpiresAt(row.id, 'challonge')"
                        name="schedule"
                        size="10px"
                        class="q-mr-xs text-grey-5"
                      />
                      <img
                        :src="challongeIcoUrl"
                        alt="Challonge"
                        style="width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; transform: scale(1.15);"
                      >
                      <QTooltip>
                        Challonge
                        <span v-if="playerSources(row.id).includes('challonge') && playerExpiresAt(row.id, 'challonge')">
                          · {{ t('playersTemporary') }} · {{ t('playersExpires').replace('{date}', formatExpiresAt(playerExpiresAt(row.id, 'challonge')!)) }}
                        </span>
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
                </div>
              </div>
            </QTd>
          </template>

          <!-- COUNTRY CELL WITH SVG FLAG -->
          <template #body-cell-country="{ row }">
            <QTd align="left">
              <div
                v-if="row.country"
                class="row items-center q-gutter-x-xs"
              >
                <img
                  v-if="getFlagSvgUrl(row.country)"
                  :src="getFlagSvgUrl(row.country)!"
                  :alt="row.country"
                  style="width: 18px; height: 13px; border-radius: 2px; object-fit: cover;"
                >
                <span>{{ getCountryLabel(row.country, locale) }}</span>
              </div>
              <span
                v-else
                style="color: var(--text-muted)"
              >—</span>
            </QTd>
          </template>

          <!-- SOCIALS CELL -->
          <template #body-cell-socials="{ row }">
            <QTd align="left">
              <div class="row items-center q-gutter-x-sm">
                <a
                  v-if="row.twitter"
                  :href="`https://twitter.com/${row.twitter.replace('@', '')}`"
                  target="_blank"
                  class="row items-center text-caption"
                  style="text-decoration: none; color: var(--text-base);"
                >
                  <svg
                    viewBox="0 0 24 24"
                    style="width: 14px; height: 14px; fill: currentColor; margin-right: 4px;"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  @{{ row.twitter.replace('@', '') }}
                </a>
                <span
                  v-if="row.twitter && row.twitch"
                  style="color: var(--text-muted)"
                >•</span>
                <a
                  v-if="row.twitch"
                  :href="`https://twitch.tv/${row.twitch}`"
                  target="_blank"
                  class="row items-center text-caption"
                  style="text-decoration: none; color: #9146FF;"
                >
                  <img
                    :src="twitchSvgUrl"
                    style="width: 14px; height: 14px; margin-right: 4px;"
                    alt="Twitch"
                  >
                  {{ row.twitch }}
                </a>
                <span
                  v-if="!row.twitter && !row.twitch"
                  style="color: var(--text-muted)"
                >—</span>
              </div>
            </QTd>
          </template>

          <!-- ACTIONS CELL WITH INDIVIDUAL MAKE PERMANENT BTN -->
          <template #body-cell-actions="{ row }">
            <QTd align="right">
              <!-- INDIVIDUAL MAKE PERMANENT BTN -->
              <QBtn
                v-if="isTemporary(row.id)"
                size="sm"
                flat
                color="warning"
                icon="person_add"
                class="subtle-action-btn q-mr-xs"
                @click="promoteSinglePlayer(row.id)"
              >
                <QTooltip>{{ t('playersMakePermanentTooltip') }}</QTooltip>
              </QBtn>

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
                icon="delete"
                class="subtle-action-btn transition-all"
                @click="requestDeletePlayer(row)"
              />
            </QTd>
          </template>
        </QTable>
      </div>
    </div>

    <!-- STARTGG IMPORT DIALOG -->
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
            <div class="import-player-list">
              <div
                v-for="player in startgg.players"
                :key="player.id"
                class="import-player-row"
                :class="{ 'import-player-row--exists': startgg.playerExistenceMap.get(player.id) }"
                @click="() => {
                  const idx = startgg.selectedPlayerIds.indexOf(player.id);
                  if (idx >= 0) startgg.selectedPlayerIds.splice(idx, 1);
                  else startgg.selectedPlayerIds.push(player.id);
                }"
              >
                <QCheckbox
                  :model-value="startgg.selectedPlayerIds.includes(player.id)"
                  dense
                  color="primary"
                  class="q-mr-sm"
                  @update:model-value="(v) => {
                    if (v) startgg.selectedPlayerIds.push(player.id);
                    else startgg.selectedPlayerIds.splice(startgg.selectedPlayerIds.indexOf(player.id), 1);
                  }"
                  @click.stop
                />
                <span class="import-player-row__name row items-center">
                  {{ player.gamertag }}
                  <span
                    v-if="player.team"
                    class="text-grey-5 q-ml-xs"
                  > ({{ player.team }})</span>
                  <img
                    v-if="player.country && getFlagSvgUrl(player.country)"
                    :src="getFlagSvgUrl(player.country)!"
                    class="q-ml-sm"
                    style="width: 16px; height: 12px; border-radius: 2px; object-fit: cover;"
                    :title="getCountryLabel(player.country, locale)"
                  >
                </span>
                <QChip
                  v-if="startgg.playerExistenceMap.get(player.id)"
                  dense
                  class="import-exists-chip q-ml-auto"
                  color="primary"
                  text-color="white"
                >
                  <QIcon
                    name="check_circle"
                    size="14px"
                    class="q-mr-xs"
                  />
                  {{ t('playersAlreadyImported') }}
                  <QTooltip>{{ t('playersAlreadyImportedTooltip') }}</QTooltip>
                </QChip>
              </div>
            </div>
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

    <!-- CHALLONGE IMPORT DIALOG -->
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
            <div class="import-player-list">
              <div
                v-for="player in challonge.players"
                :key="player.id"
                class="import-player-row"
                :class="{ 'import-player-row--exists': challonge.playerExistenceMap.get(player.id) }"
                @click="() => {
                  const idx = challonge.selectedPlayerIds.indexOf(player.id);
                  if (idx >= 0) challonge.selectedPlayerIds.splice(idx, 1);
                  else challonge.selectedPlayerIds.push(player.id);
                }"
              >
                <QCheckbox
                  :model-value="challonge.selectedPlayerIds.includes(player.id)"
                  dense
                  color="primary"
                  class="q-mr-sm"
                  @update:model-value="(v) => {
                    if (v) challonge.selectedPlayerIds.push(player.id);
                    else challonge.selectedPlayerIds.splice(challonge.selectedPlayerIds.indexOf(player.id), 1);
                  }"
                  @click.stop
                />
                <span class="import-player-row__name row items-center">
                  {{ player.gamertag }}
                  <span
                    v-if="player.team"
                    class="text-grey-5 q-ml-xs"
                  > ({{ player.team }})</span>
                  <img
                    v-if="player.country && getFlagSvgUrl(player.country)"
                    :src="getFlagSvgUrl(player.country)!"
                    class="q-ml-sm"
                    style="width: 16px; height: 12px; border-radius: 2px; object-fit: cover;"
                    :title="getCountryLabel(player.country, locale)"
                  >
                </span>
                <QChip
                  v-if="challonge.playerExistenceMap.get(player.id)"
                  dense
                  class="import-exists-chip q-ml-auto"
                  color="primary"
                  text-color="white"
                >
                  <QIcon
                    name="check_circle"
                    size="14px"
                    class="q-mr-xs"
                  />
                  {{ t('playersAlreadyImported') }}
                  <QTooltip>{{ t('playersAlreadyImportedTooltip') }}</QTooltip>
                </QChip>
              </div>
            </div>
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

    <!-- EDIT / CREATE PLAYER DIALOG -->
    <QDialog
      v-model="isDialogOpen"
      backdrop-filter="blur(4px) brightness(60%)"
    >
      <QCard class="players-dialog glass-panel">
        <QCardSection class="row items-center justify-between">
          <div class="text-h6 panel-header">
            {{ editingId ? t('playersEditPlayer') : t('playersNewPlayer') }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection>
          <QForm @submit.prevent="savePlayer">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
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
              <div class="col-12 col-md-6">
                <QInput
                  v-model="form.name"
                  :label="t('playersLabelName')"
                  dense
                  class="underlined-field"
                />
              </div>
              <div class="col-12 col-md-6">
                <QInput
                  v-model="form.team"
                  :label="t('playersLabelTeam')"
                  dense
                  class="underlined-field"
                />
              </div>
              <div class="col-12 col-md-6">
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
                >
                  <template #option="scope">
                    <QItem v-bind="scope.itemProps">
                      <QItemSection
                        avatar
                        style="min-width: 24px; padding-right: 8px;"
                      >
                        <img
                          v-if="getFlagSvgUrl(scope.opt.value)"
                          :src="getFlagSvgUrl(scope.opt.value)!"
                          :alt="scope.opt.value"
                          style="width: 18px; height: 13px; border-radius: 2px; object-fit: cover;"
                        >
                      </QItemSection>
                      <QItemSection>
                        <QItemLabel>{{ scope.opt.label }}</QItemLabel>
                      </QItemSection>
                    </QItem>
                  </template>
                </QSelect>
              </div>
              <div class="col-12 col-md-6">
                <QInput
                  v-model="form.twitter"
                  :label="t('playersLabelTwitter')"
                  dense
                  class="underlined-field"
                />
              </div>
              <div class="col-12 col-md-6">
                <QInput
                  v-model="form.twitch"
                  :label="t('playersLabelTwitch')"
                  dense
                  class="underlined-field"
                />
              </div>
              <div class="col-12">
                <QInput
                  v-model="form.avatarUrl"
                  :label="t('playersLabelAvatarUrl')"
                  dense
                  class="underlined-field"
                />
              </div>
            </div>

            <!-- PLATFORM LINKS -->
            <div class="platform-links-section q-mt-lg">
              <div class="text-caption text-weight-medium q-mb-sm platform-links-header">
                <QIcon
                  name="link"
                  size="xs"
                  class="q-mr-xs"
                />
                {{ t('playersPlatformLinks') }}
              </div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <QChip
                    v-if="form.startggId"
                    removable
                    color="dark"
                    text-color="white"
                    class="q-px-md"
                    @remove="form.startggId = ''"
                  >
                    <img
                      :src="startggSvgUrl"
                      alt="start.gg"
                      style="width: 14px; height: 14px; margin-right: 8px;"
                    >
                    {{ t('playersPlatformLinked').replace('{platform}', 'start.gg') }}
                  </QChip>
                  <QChip
                    v-else
                    color="dark"
                    text-color="grey-7"
                    class="q-px-md"
                  >
                    <img
                      :src="startggSvgUrl"
                      alt="start.gg"
                      style="width: 14px; height: 14px; margin-right: 8px; filter: grayscale(1); opacity: 0.5;"
                    >
                    {{ t('playersPlatformUnlinked') }}
                  </QChip>
                </div>
                <div class="col-12 col-md-6">
                  <QChip
                    v-if="form.challongeId"
                    removable
                    color="dark"
                    text-color="white"
                    class="q-px-md"
                    @remove="form.challongeId = ''"
                  >
                    <img
                      :src="challongeIcoUrl"
                      alt="Challonge"
                      style="width: 14px; height: 14px; margin-right: 8px; transform: scale(1.15);"
                    >
                    {{ t('playersPlatformLinked').replace('{platform}', 'Challonge') }}
                  </QChip>
                  <QChip
                    v-else
                    color="dark"
                    text-color="grey-7"
                    class="q-px-md"
                  >
                    <img
                      :src="challongeIcoUrl"
                      alt="Challonge"
                      style="width: 14px; height: 14px; margin-right: 8px; filter: grayscale(1); opacity: 0.5; transform: scale(1.15);"
                    >
                    {{ t('playersPlatformUnlinked') }}
                  </QChip>
                </div>
              </div>
            </div>
          </QForm>
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            flat
            no-caps
            :label="t('playersBtnCancel')"
            color="secondary"
            class="flat-back-btn"
            @click="isDialogOpen = false"
          />
          <QBtn
            unelevated
            no-caps
            color="primary"
            :label="t('playersBtnSave')"
            class="primary-action-btn"
            @click="savePlayer"
          />
        </QCardActions>
      </QCard>
    </QDialog>

    <!-- BULK SET TEAM DIALOG -->
    <QDialog
      v-model="isBulkTeamDialogOpen"
      backdrop-filter="blur(4px) brightness(60%)"
    >
      <QCard class="players-dialog glass-panel">
        <QCardSection>
          <div class="text-h6 panel-header">
            {{ t('playersBulkSetTeam') }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection>
          <QInput
            v-model="bulkTeamInput"
            :label="t('playersLabelTeam')"
            dense
            class="underlined-field"
            autofocus
          />
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            flat
            no-caps
            label="Cancel"
            color="secondary"
            class="flat-back-btn"
            @click="isBulkTeamDialogOpen = false"
          />
          <QBtn
            unelevated
            no-caps
            color="primary"
            label="Save"
            class="primary-action-btn"
            @click="saveBulkTeam"
          />
        </QCardActions>
      </QCard>
    </QDialog>

    <!-- MERGE DUPLICATES DIALOG -->
    <QDialog
      v-model="isMergeDialogOpen"
      backdrop-filter="blur(4px) brightness(60%)"
    >
      <QCard class="players-dialog glass-panel">
        <QCardSection>
          <div class="text-h6 panel-header">
            {{ t('playersMergeDialogTitle') }}
          </div>
          <div class="text-caption text-grey-5">
            {{ t('playersSelectPrimaryPlayer') }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection class="column q-gutter-md">
          <div
            v-for="group in detectedDuplicateGroups"
            :key="group.normalizedTag"
            class="q-pa-md bordered rounded-borders glass-panel"
          >
            <div class="text-subtitle2 text-primary q-mb-xs">
              Duplicates for "{{ group.normalizedTag }}"
            </div>
            <QOptionGroup
              v-model="group.primaryId"
              type="radio"
              :options="group.candidates.map(c => ({
                label: `${c.gamertag} ${c.team ? `(${c.team})` : ''} - ${c.country || 'No Country'} [ID: ${c.id.slice(0, 8)}]`,
                value: c.id,
              }))"
            />
            <div class="row justify-end q-mt-sm">
              <QBtn
                unelevated
                no-caps
                size="sm"
                color="primary"
                label="Merge Group"
                @click="executeMerge(group)"
              />
            </div>
          </div>
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            flat
            no-caps
            label="Close"
            color="secondary"
            class="flat-back-btn"
            @click="isMergeDialogOpen = false"
          />
        </QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>

<style scoped lang="scss">

.players-page {
  padding-top: 32px;
}

.table-header {
  padding: 0 24px;
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


.players-search {
  min-width: 220px;
}

.players-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
}

.players-main-column {
  min-width: 0;
  flex: 1 1 auto;
}

.players-import-column {
  min-width: 300px;
}

.players-dialog {
  min-width: 320px;
  width: min(720px, 90vw);
}

.players-source-chip {
  height: 18px;
  padding: 0 4px;
  background: transparent;
}

.duplicate-detected-bar {
  border: 1px solid rgba(244, 162, 97, 0.4);
  background: rgba(244, 162, 97, 0.08);
  border-radius: 8px;
}

.bulk-selection-bar {
  border: 1px solid rgba(230, 107, 60, 0.4);
  background: rgba(230, 107, 60, 0.08);
  border-radius: 8px;
}

.origin-tabs {
  border-radius: 6px;
  padding: 2px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
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

.transparent-stepper {
  background: transparent;

  :deep(.q-stepper__tab) {
    padding: 8px 0;
    min-height: unset;
    color: var(--text-muted);
  }

  :deep(.q-stepper__tab--active) {
    color: var(--text-base);
  }

  :deep(.q-stepper__step-inner) {
    padding: 0 0 8px 36px;
  }

  :deep(.q-stepper__dot) {
    width: 24px;
    min-width: 24px;
    height: 24px;
    font-size: 11px;
  }
}

.transparent-stepper.no-padding {
  padding: 0;
}

.provider-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 2px;
  flex-shrink: 0;
}

.import-player-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 360px;
  overflow-y: auto;
}

.import-player-row {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: var(--bg-subtle);
    border-color: var(--border-subtle);
  }

  &--exists {
    border-color: rgba(230, 107, 60, 0.2);
    background: rgba(230, 107, 60, 0.04);
  }
}

.import-player-row__name {
  flex: 1;
  font-size: 0.85rem;
  color: var(--text-base);
  user-select: none;
}

.import-exists-chip {
  height: 20px;
  font-size: 0.7rem;
  padding: 0 6px;
}

.platform-links-header {
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 4px;
}

.platform-links-section {
  padding-top: 4px;
}
</style>
