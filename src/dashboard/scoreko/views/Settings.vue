<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { useQuasar } from 'quasar';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TEMP_FALLBACK_DURATION_SECONDS, LS_KEYS } from '../../../shared/constants';
import { useIntegration } from '../composables/useIntegration';
import type { Locale } from '../i18n';
import { locale, setLocale, t } from '../i18n';
import { usePlayersStore } from '../stores/players';
import {
  eventToShortcut,
  type ShortcutAction,
  useShortcutSettingsStore,
} from '../stores/shortcut-settings';

defineOptions({ name: 'SettingsView' });

useHead(() => ({ title: t('settingsTitle') }));

const languageOptions = computed(() => [
  { label: t('languageEnglish'), value: 'en' as const },
  { label: t('languageSpanish'), value: 'es' as const },
]);

const selectedLanguage = computed<Locale>({
  get: () => locale.value,
  set: (value) => { setLocale(value); },
});

const shortcutSettingsStore = useShortcutSettingsStore();
const recordingAction = ref<ShortcutAction | null>(null);
const shortcutsContainerRef = ref<HTMLElement | null>(null);

const shortcutFields = computed<{ action: ShortcutAction; label: string; hint: string }[]>(() => [
  { action: 'leftIncrement', label: t('settingsShortcutLeftIncrementLabel'), hint: t('settingsShortcutLeftIncrementHint') },
  { action: 'leftDecrement', label: t('settingsShortcutLeftDecrementLabel'), hint: t('settingsShortcutLeftDecrementHint') },
  { action: 'rightIncrement', label: t('settingsShortcutRightIncrementLabel'), hint: t('settingsShortcutRightIncrementHint') },
  { action: 'rightDecrement', label: t('settingsShortcutRightDecrementLabel'), hint: t('settingsShortcutRightDecrementHint') },
  { action: 'swapSides', label: t('settingsShortcutSwapLabel'), hint: t('settingsShortcutSwapHint') },
]);

const conflictingActions = computed(() => {
  const seen = new Map<string, ShortcutAction>();
  const conflicts = new Set<ShortcutAction>();
  for (const [action, shortcut] of Object.entries(shortcutSettingsStore.shortcuts) as [ShortcutAction, string][]) {
    if (seen.has(shortcut)) {
      conflicts.add(action);
      conflicts.add(seen.get(shortcut)!);
    } else {
      seen.set(shortcut, action);
    }
  }
  return conflicts;
});

const stopRecording = () => {
  if (!recordingAction.value) return;
  recordingAction.value = null;
  if (typeof document !== 'undefined') {
    delete document.body.dataset.shortcutRecording;
    document.removeEventListener('mousedown', onDocumentMousedown);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onRecordKeydown);
  }
};

const onRecordKeydown = (event: KeyboardEvent) => {
  if (!recordingAction.value) return;
  if (event.key === 'Escape') { event.preventDefault(); stopRecording(); return; }
  const shortcut = eventToShortcut(event);
  if (!shortcut) return;
  event.preventDefault();
  shortcutSettingsStore.setShortcut(recordingAction.value, shortcut);
  stopRecording();
};

const onDocumentMousedown = (event: MouseEvent) => {
  if (recordingAction.value && shortcutsContainerRef.value && !shortcutsContainerRef.value.contains(event.target as Node)) {
    stopRecording();
  }
};

const startRecording = (action: ShortcutAction) => {
  if (recordingAction.value === action) { stopRecording(); return; }
  stopRecording();
  recordingAction.value = action;
  if (typeof document !== 'undefined') {
    document.body.dataset.shortcutRecording = 'true';
    document.addEventListener('mousedown', onDocumentMousedown);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onRecordKeydown);
  }
};

onBeforeUnmount(() => {
  stopRecording();
});

const STARTGG_TEMP_PLAYERS_STORAGE_KEY = LS_KEYS.STARTGG_TEMP_PLAYERS;
const CHALLONGE_TEMP_PLAYERS_STORAGE_KEY = LS_KEYS.CHALLONGE_TEMP_PLAYERS;
const playersStore = usePlayersStore();
const $q = useQuasar();
const route = useRoute();
const router = useRouter();

const activeTab = ref(route.hash === '#integrations' ? 'integrations' : 'general');

watch(() => route.hash, (newHash) => {
  const targetTab = newHash === '#integrations' ? 'integrations' : 'general';
  if (activeTab.value !== targetTab) {
    activeTab.value = targetTab;
  }
});

watch(activeTab, (newTab) => {
  const targetHash = newTab === 'general' ? '' : `#${newTab}`;
  if (route.hash !== targetHash) {
    router.replace({ hash: targetHash });
  }
});

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
  on401Message: t('settingsChallongeRejectedToken'),
  playersStore,
});

const isStartggManualDialogOpen = ref(false);
const startggManualDraft = ref('');

const openStartggManualDialog = () => {
  startggManualDraft.value = '';
  isStartggManualDialogOpen.value = true;
};

const saveStartggManualToken = () => {
  const tokenValue = startggManualDraft.value.trim();
  startgg.setManualToken(tokenValue);
  isStartggManualDialogOpen.value = false;
  $q.notify({ type: 'positive', message: tokenValue ? t('settingsStartggTokenSaved') : t('settingsStartggTokenRemoved') });
};

const isChallongeManualDialogOpen = ref(false);
const challongeManualDraft = ref('');

const openChallongeManualDialog = () => {
  challongeManualDraft.value = '';
  isChallongeManualDialogOpen.value = true;
};

const saveChallongeManualToken = () => {
  const tokenValue = challongeManualDraft.value.trim();
  challonge.setManualToken(tokenValue);
  isChallongeManualDialogOpen.value = false;
  $q.notify({ type: 'positive', message: tokenValue ? t('settingsChallongeTokenSaved') : t('settingsChallongeTokenRemoved') });
};

const challongeConnectionLabel = computed(() =>
  challonge.hasValidatedToken ? t('playersConnected') : t('settingsTokenSet'),
);

watch(() => startgg.importDialogError, (msg) => {
  if (msg) $q.notify({ type: 'negative', message: msg });
});
watch(() => challonge.importDialogError, (msg) => {
  if (msg) $q.notify({ type: 'negative', message: msg });
});
</script>

<template>
  <QPage class="settings-page">
    <div class="settings-layout">
      <QTabs
        v-model="activeTab"
        align="left"
        class="text-grey-7 q-mb-lg"
        active-color="primary"
        indicator-color="primary"
        narrow-indicator
        dense
      >
        <QTab
          name="general"
          :label="t('settingsCategoryGeneral')"
          no-caps
        />
        <QTab
          name="integrations"
          :label="t('settingsCategoryIntegrations')"
          no-caps
        />
      </QTabs>

      <QTabPanels
        v-model="activeTab"
        animated
        class="bg-transparent"
      >
        <QTabPanel
          name="general"
          class="column q-gutter-lg q-pa-none"
        >
          <QCard
            class="glass-panel settings-card"
          >
            <QCardSection>
              <div class="row items-center q-gutter-md">
                <div class="col">
                  <div class="text-subtitle1 text-weight-medium">
                    {{ t('settingsLanguageLabel') }}
                  </div>
                  <div class="text-caption text-grey-6">
                    {{ t('settingsLanguageHint') }}
                  </div>
                </div>
                <div class="col-auto">
                  <QSelect
                    v-model="selectedLanguage"
                    emit-value
                    map-options
                    :options="languageOptions"
                    dense
                    options-dense
                    color="primary"
                    popup-content-class="glass-panel glass-dropdown"
                    class="dark-input settings-lang-select"
                  />
                </div>
              </div>
            </QCardSection>
          </QCard>

          <QCard
            class="glass-panel settings-card"
          >
            <QCardSection>
              <div class="row items-center justify-between q-mb-sm">
                <div>
                  <div class="text-subtitle1 text-weight-medium">
                    {{ t('settingsShortcutTitle') }}
                  </div>
                  <div class="text-caption text-grey-6">
                    {{ t('settingsShortcutDescription') }}
                  </div>
                </div>
                <QBtn
                  class="subtle-action-btn"
                  icon="restart_alt"
                  no-caps
                  :label="t('settingsShortcutReset')"
                  @click="shortcutSettingsStore.resetShortcuts"
                >
                  <QTooltip class="glass-tooltip">
                    {{ t('tooltipResetShortcuts') }}
                  </QTooltip>
                </QBtn>
              </div>

              <QBanner
                v-if="conflictingActions.size > 0"
                class="bg-warning text-white q-mb-md"
                rounded
                dense
              >
                <template #avatar>
                  <QIcon
                    name="warning"
                    color="white"
                  />
                </template>
                {{ t('settingsShortcutConflictWarning') }}
              </QBanner>

              <QList
                separator
                class="q-mt-md"
              >
                <QItem
                  v-for="field in shortcutFields"
                  :key="field.action"
                  class="q-px-none q-py-sm"
                >
                  <QItemSection>
                    <QItemLabel class="text-body2 text-weight-medium">
                      {{ field.label }}
                    </QItemLabel>
                    <QItemLabel
                      caption
                      :class="{ 'text-negative': recordingAction === field.action }"
                    >
                      {{ recordingAction === field.action ? t('settingsShortcutRecordingHint') : field.hint }}
                    </QItemLabel>
                  </QItemSection>
                  <QItemSection side>
                    <QInput
                      :model-value="shortcutSettingsStore.shortcuts[field.action]"
                      :color="
                        recordingAction === field.action
                          ? 'negative'
                          : conflictingActions.has(field.action)
                            ? 'warning'
                            : 'primary'
                      "
                      readonly
                      dense
                      class="dark-input"
                      style="min-width: 220px"
                    >
                      <template #append>
                        <QBtn
                          flat
                          round
                          dense
                          :icon="recordingAction === field.action ? 'stop_circle' : 'keyboard'"
                          :color="recordingAction === field.action ? 'negative' : 'primary'"
                          :aria-label="recordingAction === field.action ? t('settingsShortcutStopRecording') : t('settingsShortcutStartRecording')"
                          @click="startRecording(field.action)"
                        />
                        <QBtn
                          flat
                          round
                          dense
                          icon="restart_alt"
                          color="grey-5"
                          :aria-label="t('settingsShortcutResetSingle')"
                          @click="shortcutSettingsStore.resetShortcut(field.action)"
                        >
                          <QTooltip>{{ t('settingsShortcutResetSingle') }}</QTooltip>
                        </QBtn>
                      </template>
                    </QInput>
                  </QItemSection>
                </QItem>
              </QList>
            </QCardSection>
          </QCard>
        </QTabPanel>

        <QTabPanel
          name="integrations"
          class="column q-gutter-lg q-pa-none"
        >
          <div>
            <div class="text-overline text-grey-6 q-mb-xs">
              {{ t('settingsIntegrationsTitle') }}
            </div>
            <div class="text-caption text-grey-6">
              {{ t('settingsIntegrationsDescription') }}
            </div>
          </div>

          <QCard
            class="glass-panel settings-card"
          >
            <QCardSection>
              <div class="row items-center q-mb-md q-gutter-x-sm">
                <img
                  src="../assets/startgg.svg"
                  alt="start.gg"
                  style="width: 24px; height: 24px; border-radius: 4px; flex-shrink: 0;"
                >
                <span class="text-subtitle1 text-weight-medium">start.gg</span>
                <QSpace />
                <div class="row q-gutter-sm items-center">
                  <QBtn
                    v-if="startgg.hasTokenConfigured"
                    unelevated
                    no-caps
                    :color="startgg.hasValidatedToken ? 'positive' : 'warning'"
                    text-color="white"
                    icon="check_circle"
                    :label="t('playersConnected')"
                    tabindex="-1"
                    style="pointer-events: none;"
                  />
                  <QBtn
                    v-if="!startgg.hasTokenConfigured"
                    class="primary-action-btn"
                    color="primary"
                    icon="login"
                    no-caps
                    :label="t('playersConnectStartgg')"
                    :loading="startgg.oauthLoading"
                    @click="startgg.connectWithOAuth"
                  />
                  <QBtn
                    v-else
                    class="subtle-action-btn"
                    flat
                    color="negative"
                    icon="link_off"
                    no-caps
                    :label="t('settingsDisconnect')"
                    @click="startggManualDraft = ''; startgg.setManualToken(''); $q.notify({ type: 'info', message: t('settingsStartggDisconnected') })"
                  >
                    <QTooltip class="glass-tooltip">
                      {{ t('tooltipDisconnectAccount') }}
                    </QTooltip>
                  </QBtn>
                  <QBtn
                    class="subtle-action-btn"
                    flat
                    :color="startgg.hasTokenConfigured ? 'grey-5' : 'grey-4'"
                    icon="vpn_key"
                    no-caps
                    :label="t('playersUsePersonalApi')"
                    :disable="startgg.hasTokenConfigured"
                    @click="openStartggManualDialog"
                  >
                    <QTooltip class="glass-tooltip">
                      {{ t('tooltipManualApiToken') }}
                    </QTooltip>
                  </QBtn>
                </div>
              </div>
              <div class="text-body2 text-grey-7">
                {{ t('playersStartggHelp') }}
              </div>
            </QCardSection>
          </QCard>

          <QCard
            class="glass-panel settings-card"
          >
            <QCardSection>
              <div class="row items-center q-mb-md q-gutter-x-sm">
                <img
                  src="../assets/challonge.ico"
                  alt="Challonge"
                  style="width: 24px; height: 24px; border-radius: 6px; flex-shrink: 0;"
                >
                <span class="text-subtitle1 text-weight-medium">Challonge</span>
                <QSpace />
                <div class="row q-gutter-sm items-center">
                  <QBtn
                    v-if="challonge.hasTokenConfigured"
                    unelevated
                    no-caps
                    :color="challonge.hasValidatedToken ? 'positive' : 'warning'"
                    text-color="white"
                    icon="check_circle"
                    :label="challongeConnectionLabel"
                    tabindex="-1"
                    style="pointer-events: none;"
                  />
                  <QBtn
                    v-if="challonge.hasTokenConfigured"
                    class="subtle-action-btn"
                    flat
                    color="negative"
                    icon="link_off"
                    no-caps
                    :label="t('settingsDisconnect')"
                    @click="challongeManualDraft = ''; challonge.setManualToken(''); $q.notify({ type: 'info', message: t('settingsChallongeDisconnected') })"
                  >
                    <QTooltip class="glass-tooltip">
                      {{ t('tooltipDisconnectAccount') }}
                    </QTooltip>
                  </QBtn>
                  <QBtn
                    v-else
                    class="primary-action-btn"
                    color="primary"
                    icon="vpn_key"
                    no-caps
                    :label="t('playersUsePersonalApi')"
                    @click="openChallongeManualDialog"
                  >
                    <QTooltip class="glass-tooltip">
                      {{ t('tooltipManualApiToken') }}
                    </QTooltip>
                  </QBtn>
                </div>
              </div>
              <div class="text-body2 text-grey-7">
                {{ t('playersChallongeHelp') }}
              </div>
            </QCardSection>
          </QCard>
        </QTabPanel>
      </QTabPanels>
    </div>
    <QDialog v-model="isStartggManualDialogOpen">
      <QCard class="settings-dialog glass-panel">
        <QCardSection>
          <div class="text-h6">
            {{ t('settingsStartggManualTitle') }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection>
          <div class="text-body2 q-mb-sm">
            {{ t('settingsStartggManualDesc') }}
          </div>
          <ol class="q-pl-md q-mb-md settings-token-steps">
            <li>{{ t('settingsStartggManualStep1') }}</li>
            <li>{{ t('settingsStartggManualStep2') }}</li>
            
            <!-- eslint-disable-next-line vue/no-v-html -->
            <li v-html="t('settingsStartggManualStep3')" />
            <li>{{ t('settingsStartggManualStep4') }}</li>
            <li>{{ t('settingsStartggManualStep5') }}</li>
          </ol>
          <QInput
            v-model="startggManualDraft"
            :label="t('settingsStartggManualPaste')"
            dense
            class="dark-input"
            type="password"
          />
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            class="subtle-action-btn"
            flat
            no-caps
            :label="t('settingsManualCancel')"
            color="secondary"
            @click="isStartggManualDialogOpen = false"
          />
          <QBtn
            class="subtle-action-btn"
            flat
            no-caps
            color="negative"
            :label="t('settingsManualDelete')"
            @click="startggManualDraft = ''; saveStartggManualToken()"
          />
          <QBtn
            class="primary-action-btn"
            color="primary"
            no-caps
            :label="t('settingsManualSave')"
            @click="saveStartggManualToken"
          />
        </QCardActions>
      </QCard>
    </QDialog>
    <QDialog v-model="isChallongeManualDialogOpen">
      <QCard class="settings-dialog glass-panel">
        <QCardSection>
          <div class="text-h6">
            {{ t('settingsChallongeManualTitle') }}
          </div>
        </QCardSection>
        <QSeparator />
        <QCardSection>
          <div class="text-body2 q-mb-sm">
            {{ t('settingsChallongeManualDesc') }}
          </div>
          <ol class="q-pl-md q-mb-md settings-token-steps">
            <li>{{ t('settingsChallongeManualStep1') }}</li>
            <li>{{ t('settingsChallongeManualStep2') }}</li>
            
            <!-- eslint-disable-next-line vue/no-v-html -->
            <li v-html="t('settingsChallongeManualStep3')" />
            <li>{{ t('settingsChallongeManualStep4') }}</li>
          </ol>
          <QInput
            v-model="challongeManualDraft"
            :label="t('settingsChallongeManualPaste')"
            dense
            class="dark-input"
            type="password"
          />
        </QCardSection>
        <QSeparator />
        <QCardActions align="right">
          <QBtn
            class="subtle-action-btn"
            flat
            no-caps
            :label="t('settingsManualCancel')"
            color="secondary"
            @click="isChallongeManualDialogOpen = false"
          />
          <QBtn
            class="subtle-action-btn"
            flat
            no-caps
            color="negative"
            :label="t('settingsManualDelete')"
            @click="challongeManualDraft = ''; saveChallongeManualToken()"
          />
          <QBtn
            class="primary-action-btn"
            color="primary"
            no-caps
            :label="t('settingsManualSave')"
            @click="saveChallongeManualToken"
          />
        </QCardActions>
      </QCard>
    </QDialog>
  </QPage>
</template>

<style scoped>
.settings-page {
  padding: 64px 24px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.settings-layout {
  max-width: 680px;
  width: 100%;
}

.settings-card {
  width: 100%;
}

.settings-lang-select {
  max-width: 280px;
}

.settings-dialog {
  min-width: 320px;
  width: min(560px, 90vw);
}

.settings-token-steps {
  line-height: 1.6;
}

</style>
