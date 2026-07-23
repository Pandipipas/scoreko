<script setup lang="ts">

import { useHead } from '@unhead/vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { PackManifest, PackRegistryEntry } from '../../../shared/pack-types';
import { t } from '../i18n';
import { usePacksStore } from '../stores/packs';

defineOptions({ name: 'PacksView' });
useHead(() => ({ title: t('menuPacks') }));

const packRegistry = usePacksStore();

const searchQuery = ref('');
const filterTab = ref<'all' | 'installed' | 'available' | 'updates'>('all');
const selectedPackId = ref<string | null>(null);

const selectedManifest = ref<PackManifest | null>(null);
const remoteManifest = ref<PackManifest | null>(null);
const isLoadingManifest = ref(false);
const isLoadingRemoteManifest = ref(false);

const newCharacters = computed(() => {
  if (!remoteManifest.value || !selectedManifest.value) return [];
  const existingSlugs = new Set(selectedManifest.value.characters.map((c) => c.slug));
  return remoteManifest.value.characters.filter((c) => !existingSlugs.has(c.slug));
});
const imageLoadErrors = reactive<Record<string, boolean>>({});
const logoError = ref(false);
const heroError = ref(false);
const headerError = reactive<Record<string, boolean>>({});

const isImagePreviewOpen = ref(false);
const previewImageUrl = ref('');
const previewCharName = ref('');

const totalCount = computed(() => packRegistry.registry?.packs.length ?? 0);
const installedCount = computed(() => packRegistry.installedPackIds.length);
const availableCount = computed(() => totalCount.value - installedCount.value);
const updateCount = computed(() => packRegistry.updateCount);

const selectedPack = computed<PackRegistryEntry | null>(() => {
  if (!packRegistry.registry || !selectedPackId.value) return null;
  return packRegistry.registry.packs.find((p) => p.id === selectedPackId.value) || null;
});

const selectedDownloadState = computed(() => {
  if (!selectedPackId.value) return null;
  return packRegistry.getDownloadState(selectedPackId.value);
});

const installedGameVersion = computed(() => selectedManifest.value?.gameVersion ?? null);
const installedTotalSize = computed(() => {
  if (!selectedManifest.value?.characters) return null;
  return selectedManifest.value.characters.reduce((acc, char) => acc + (char.sizeBytes || 0), 0);
});

const filteredPacks = computed<PackRegistryEntry[]>(() => {
  if (!packRegistry.registry) return [];

  const query = searchQuery.value.trim().toLowerCase();
  const filtered = packRegistry.registry.packs.filter((pack) => {
    const matchesQuery = pack.name.toLowerCase().includes(query) || pack.id.toLowerCase().includes(query);
    if (!matchesQuery) return false;

    const isInstalled = packRegistry.installedPackIds.includes(pack.id);
    const hasUpdate = Boolean(packRegistry.availableUpdates[pack.id]);

    if (filterTab.value === 'installed') return isInstalled;
    if (filterTab.value === 'available') return !isInstalled;
    if (filterTab.value === 'updates') return hasUpdate;
    return true;
  });

  return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
});

const logoSrc = computed(() => {
  if (!selectedPack.value) return '';
  const isInstalled = packRegistry.installedPackIds.includes(selectedPack.value.id);
  return isInstalled
    ? packRegistry.getLocalLogoUrl(selectedPack.value.id)
    : packRegistry.getPackLogoUrl(selectedPack.value.id);
});

const heroSrc = computed(() => {
  if (!selectedPack.value) return '';
  const isInstalled = packRegistry.installedPackIds.includes(selectedPack.value.id);
  return isInstalled
    ? packRegistry.getLocalHeroUrl(selectedPack.value.id)
    : packRegistry.getPackHeroUrl(selectedPack.value.id);
});

const loadManifests = () => {
  const newId = selectedPackId.value;

  Object.keys(imageLoadErrors).forEach((key) => delete imageLoadErrors[key]);
  logoError.value = false;
  heroError.value = false;
  Object.keys(headerError).forEach((key) => delete headerError[key]);

  if (newId) {
    isLoadingManifest.value = true;
    nodecg.sendMessage('getPackManifest', newId, (err: Error | null, result: unknown) => {
      isLoadingManifest.value = false;
      if (err) {
        console.error(`[PacksView] Error loading manifest for "${newId}":`, err);
        return;
      }
      selectedManifest.value = result as PackManifest;
    });

    if (packRegistry.availableUpdates[newId]) {
      isLoadingRemoteManifest.value = true;
      nodecg.sendMessage('getRemotePackManifest', newId, (err: Error | null, result: unknown) => {
        isLoadingRemoteManifest.value = false;
        if (err) {
          console.error(`[PacksView] Error loading remote manifest for "${newId}":`, err);
          return;
        }
        remoteManifest.value = result as PackManifest;
      });
    } else {
      remoteManifest.value = null;
    }
  } else {
    selectedManifest.value = null;
    remoteManifest.value = null;
  }
};

watch(selectedPackId, loadManifests, { immediate: true });

watch(
  () => (selectedPackId.value ? packRegistry.availableUpdates[selectedPackId.value] : undefined),
  (hasUpdate, hadUpdate) => {
    if (hadUpdate && !hasUpdate) {
      loadManifests();
    }
  }
);

const handleDownload = (packId: string) => {
  packRegistry.downloadPack(packId);
};

const handleUpdate = (packId: string) => {
  packRegistry.updatePack(packId);
};

const handleCancel = (packId: string) => {
  packRegistry.cancelPackDownload(packId);
};

const confirmingUninstallId = ref<string | null>(null);
let uninstallTimeout: ReturnType<typeof setTimeout> | null = null;

const requestUninstallPack = (pack: PackRegistryEntry) => {
  if (confirmingUninstallId.value === pack.id) {
    packRegistry.uninstallPack(pack.id);
    confirmingUninstallId.value = null;
    if (uninstallTimeout) clearTimeout(uninstallTimeout);
  } else {
    confirmingUninstallId.value = pack.id;
    if (uninstallTimeout) clearTimeout(uninstallTimeout);
    uninstallTimeout = setTimeout(() => {
      if (confirmingUninstallId.value === pack.id) {
        confirmingUninstallId.value = null;
      }
    }, 3000);
  }
};

const getCharacterImageUrl = (charSlug: string, isThumb = false): string => {
  if (!selectedPack.value) return '';
  const packId = selectedPack.value.id;
  const isInstalled = packRegistry.installedPackIds.includes(packId);
  const isCharLocallyInstalled = isInstalled &&
    (selectedManifest.value?.characters.some(c => c.slug === charSlug) ?? false);

  const suffix = isThumb ? '-thumb' : '';
  return isCharLocallyInstalled
    ? `/packs/${packId}/characters/${charSlug}${suffix}.webp`
    : packRegistry.getCharacterImageRepoUrl(packId, charSlug + suffix, 'webp');
};

const handleImagePreview = (charName: string, charSlug: string) => {
  if (imageLoadErrors[charSlug]) return;
  previewCharName.value = charName;
  previewImageUrl.value = getCharacterImageUrl(charSlug, false);
  isImagePreviewOpen.value = true;
};

const handleThumbError = (charSlug: string, event: Event) => {
  const imgElement = event.target as HTMLImageElement;
  const originalUrl = getCharacterImageUrl(charSlug, false);
  
  if (imgElement.src !== originalUrl && imgElement.src.includes('-thumb')) {
    imgElement.src = originalUrl;
  } else {
    imageLoadErrors[charSlug] = true;
  }
};

const getInitials = (name: string): string => {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

onMounted(() => {
  if (!packRegistry.registry) {
    packRegistry.fetchRegistry();
  }
});
</script>

<template>
  <QPage class="packs-page">
    <div
      v-if="!packRegistry.registry"
      class="flex flex-center q-py-xl"
    >
      <div class="text-center">
        <QSpinnerColor
          color="primary"
          size="3em"
          class="q-mb-md"
        />
        <div class="text-grey-5">
          {{ t('packsLoadingRegistry') }}
        </div>
      </div>
    </div>
    <div
      v-else
      class="row q-col-gutter-lg"
    >
      <div
        class="col-12 col-md-5 list-column"
        :class="{ 'hidden-xs-only': selectedPackId }"
      >
        <QCard
          class="glass-panel filter-card q-mb-md"
        >
          <QCardSection class="q-pb-none">
            <div class="row items-center q-gutter-sm">
              <QInput
                v-model="searchQuery"
                dense
                class="col dark-input"
                :placeholder="t('packsSearchPlaceholder')"
                clearable
              >
                <template #prepend>
                  <QIcon name="search" />
                </template>
              </QInput>
            </div>
          </QCardSection>
          <QCardSection class="q-pt-sm">
            <QTabs
              v-model="filterTab"
              dense
              no-caps
              inline-label
              class="text-grey-5 filter-tabs"
              active-color="primary"
              indicator-color="primary"
            >
              <QTab
                name="all"
              >
                <div class="row no-wrap items-center q-gutter-xs">
                  <span>{{ t('packsFilterAll') }}</span>
                  <QBadge
                    color="grey-8"
                    text-color="grey-3"
                    rounded
                  >
                    {{ totalCount }}
                  </QBadge>
                </div>
              </QTab>
              <QTab
                name="installed"
              >
                <div class="row no-wrap items-center q-gutter-xs">
                  <span>{{ t('packsFilterInstalled') }}</span>
                  <QBadge
                    color="positive"
                    text-color="white"
                    rounded
                  >
                    {{ installedCount }}
                  </QBadge>
                </div>
              </QTab>
              <QTab
                name="available"
              >
                <div class="row no-wrap items-center q-gutter-xs">
                  <span>{{ t('packsFilterAvailable') }}</span>
                  <QBadge
                    color="grey-8"
                    text-color="grey-3"
                    rounded
                  >
                    {{ availableCount }}
                  </QBadge>
                </div>
              </QTab>
              <QTab
                name="updates"
              >
                <div class="row no-wrap items-center q-gutter-xs">
                  <span>{{ t('packsFilterUpdates') }}</span>
                  <QBadge
                    v-if="updateCount > 0"
                    color="secondary"
                    text-color="white"
                    rounded
                  >
                    {{ updateCount }}
                  </QBadge>
                </div>
              </QTab>
            </QTabs>
          </QCardSection>
        </QCard>
        <QCard
          class="glass-panel list-card"
        >
          <div
            v-if="filteredPacks.length === 0"
            class="q-pa-xl text-center text-grey-6"
          >
            <QIcon
              name="inventory_2"
              size="48px"
              class="q-mb-sm"
            />
            <div>{{ t('packsNoPacksFound') }}</div>
          </div>

          <QList
            v-else
            separator
          >
            <QItem
              v-for="pack in filteredPacks"
              :key="pack.id"
              clickable
              :active="selectedPackId === pack.id"
              active-class="selected-pack-item"
              class="pack-item"
              @click="selectedPackId = pack.id"
            >
              <QItemSection avatar>
                <div
                  class="pack-mini-banner"
                  :style="{
                    background: headerError[pack.id]
                      ? `linear-gradient(135deg, ${pack.palette.start}cc, ${pack.palette.end}cc)`
                      : 'var(--bg-subtle)'
                  }"
                >
                  <img
                    v-if="!headerError[pack.id]"
                    :src="packRegistry.installedPackIds.includes(pack.id) ? packRegistry.getLocalHeaderUrl(pack.id) : packRegistry.getPackHeaderUrl(pack.id)"
                    class="pack-mini-header"
                    alt=""
                    @error="headerError[pack.id] = true"
                  >
                  <img
                    v-if="headerError[pack.id]"
                    :src="packRegistry.installedPackIds.includes(pack.id) ? packRegistry.getLocalLogoUrl(pack.id) : packRegistry.getPackLogoUrl(pack.id)"
                    class="pack-mini-logo"
                    alt=""
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  >
                  <QIcon
                    v-if="headerError[pack.id]"
                    name="sports_esports"
                    size="20px"
                    color="white"
                    class="pack-mini-icon"
                  />
                </div>
              </QItemSection>
              <QItemSection>
                <QItemLabel class="text-weight-medium text-white">
                  {{ pack.name }}
                </QItemLabel>
                <QItemLabel
                  caption
                  class="text-grey-5"
                >
                  v{{ packRegistry.availableUpdates[pack.id]?.installedVersion ?? pack.gameVersion }}
                </QItemLabel>
              </QItemSection>
              <QItemSection side>
                <template v-if="packRegistry.getDownloadState(pack.id).status === 'downloading' || packRegistry.getDownloadState(pack.id).status === 'fetching-manifest'">
                  <div class="row items-center q-gutter-xs">
                    <QSpinnerColor
                      size="14px"
                      color="primary"
                    />
                    <span class="text-caption text-primary text-weight-bold">
                      {{ packRegistry.getDownloadState(pack.id).progress }}%
                    </span>
                  </div>
                </template>
                <template v-else>
                  <QBadge
                    v-if="packRegistry.availableUpdates[pack.id]"
                    color="secondary"
                    text-color="white"
                    class="text-weight-bold"
                  >
                    {{ t('packsStatusUpdateAvailable') }}
                  </QBadge>
                  <QBadge
                    v-else-if="packRegistry.installedPackIds.includes(pack.id)"
                    color="positive"
                    class="text-weight-bold"
                  >
                    {{ t('packsStatusInstalled') }}
                  </QBadge>
                  <QBadge
                    v-else
                    color="grey-8"
                    text-color="grey-4"
                  >
                    {{ t('packsStatusAvailable') }}
                  </QBadge>
                </template>
              </QItemSection>
            </QItem>
          </QList>
        </QCard>
      </div>
      <div
        class="col-12 col-md-7 detail-column"
        :class="{ 'hidden-xs-only': !selectedPackId }"
      >
        <QCard
          v-if="!selectedPack"
          class="glass-panel empty-detail-card flex flex-center"
        >
          <div class="text-center q-pa-xl text-grey-6">
            <QIcon
              name="sports_esports"
              size="64px"
              class="q-mb-md empty-icon"
            />
            <div class="text-body1 text-weight-medium q-mb-sm">
              {{ t('packsTitle') }}
            </div>
            <div class="text-body2 empty-detail-message">
              {{ t('packsSelectedPlaceholder') }}
            </div>
          </div>
        </QCard>
        <QCard
          v-else
          class="glass-panel detail-card"
        >
          <div class="lt-md q-pa-sm bg-dark-page border-bottom">
            <QBtn
              flat
              dense
              no-caps
              class="flat-back-btn"
              color="primary"
              icon="arrow_back"
              :label="t('packsBackBtn')"
              @click="selectedPackId = null"
            />
          </div>
          <div
            class="detail-banner"
            :style="{
              background: (heroSrc && !heroError) ? 'var(--bg-subtle)' : `linear-gradient(135deg, ${selectedPack.palette.start}, ${selectedPack.palette.end})`
            }"
          >
            <img
              v-if="heroSrc && !heroError"
              :src="heroSrc"
              class="banner-bg-img"
              alt=""
              @error="heroError = true"
            >
            <div
              v-if="!(heroSrc && !heroError)"
              class="banner-noise"
            />
            <div class="banner-content-layer">
              <div
                class="banner-logo-wrap"
                :class="{ 'align-bottom-left': heroSrc && !heroError }"
              >
                <img
                  v-if="logoSrc && !logoError"
                  :src="logoSrc"
                  class="detail-logo"
                  alt=""
                  @error="logoError = true"
                >
              </div>
            </div>
          </div>

          <div class="stats-bar">
            <div class="stats-bar__action">
              <template v-if="selectedDownloadState && (selectedDownloadState.status === 'downloading' || selectedDownloadState.status === 'fetching-manifest')">
                <QBtn
                  unelevated
                  no-caps
                  class="stats-bar__primary-btn"
                  color="primary"
                  icon="pause"
                  :label="t('packsCancelBtn')"
                  @click="handleCancel(selectedPack.id)"
                />
              </template>
              <template v-else-if="!packRegistry.installedPackIds.includes(selectedPack.id)">
                <QBtn
                  unelevated
                  no-caps
                  class="stats-bar__primary-btn"
                  color="primary"
                  icon="download"
                  :label="t('packsInstallBtn')"
                  @click="handleDownload(selectedPack.id)"
                />
              </template>
              <template v-else>
                <div class="stats-bar__installed-actions">
                  <QBtn
                    v-if="packRegistry.availableUpdates[selectedPack.id]"
                    unelevated
                    no-caps
                    class="stats-bar__primary-btn animate-pulse"
                    color="secondary"
                    icon="sync"
                    :label="t('packsUpdateBtn')"
                    @click="handleUpdate(selectedPack.id)"
                  />
                  <QBtn
                    unelevated
                    no-caps
                    class="stats-bar__uninstall-btn transition-all"
                    :class="{ 'stats-bar__uninstall-btn--confirming': confirmingUninstallId === selectedPack.id }"
                    color="negative"
                    :icon="confirmingUninstallId === selectedPack.id ? 'warning' : 'delete_outline'"
                    :label="confirmingUninstallId === selectedPack.id ? t('packsUninstallSure') : t('packsUninstallBtn')"
                    @click="requestUninstallPack(selectedPack)"
                  />
                </div>
              </template>
            </div>

            
            <div
              class="stats-bar__stat"
              :class="{ 'stats-bar__stat--downloading': selectedDownloadState && (selectedDownloadState.status === 'downloading' || selectedDownloadState.status === 'fetching-manifest') }"
            >
              <template v-if="selectedDownloadState && (selectedDownloadState.status === 'downloading' || selectedDownloadState.status === 'fetching-manifest')">
                <div class="stats-bar__download-label text-weight-bold text-uppercase">
                  {{ selectedDownloadState.status === 'fetching-manifest' ? t('packsStatusFetchingManifest') : (packRegistry.availableUpdates[selectedPack.id] ? t('packsUpdateBtn') : t('packsStatusDownloading')) }}
                </div>
                <div class="stats-bar__download-progress-text text-grey-5">
                  {{ selectedDownloadState.progress }}%
                </div>
                <QLinearProgress
                  :value="selectedDownloadState.progress / 100"
                  color="primary"
                  size="4px"
                  class="stats-bar__progress"
                />
              </template>
              <template v-else>
                <div class="stats-bar__label">
                  <QIcon
                    name="info_outline"
                    size="12px"
                    class="q-mr-xs"
                  />
                  {{ t('packsStatLabel') }}
                </div>
                <div class="stats-bar__value">
                  <template v-if="packRegistry.availableUpdates[selectedPack.id]">
                    <QIcon
                      name="update"
                      size="14px"
                      color="secondary"
                    />
                    <span class="text-secondary text-weight-bold">{{ t('packsStatusUpdateAvailable') }}</span>
                  </template>
                  <template v-else-if="packRegistry.installedPackIds.includes(selectedPack.id)">
                    <QIcon
                      name="check_circle"
                      size="14px"
                      color="positive"
                    />
                    <span class="text-positive text-weight-bold">{{ t('packsStatusInstalled') }}</span>
                  </template>
                  <template v-else>
                    <QIcon
                      name="cloud_download"
                      size="14px"
                      color="grey-5"
                    />
                    <span class="text-grey-5">{{ t('packsStatusAvailable') }}</span>
                  </template>
                </div>
              </template>
            </div>

            <div class="stats-bar__divider" />

            
            <div class="stats-bar__stat">
              <div class="stats-bar__label">
                <QIcon
                  name="sports_esports"
                  size="12px"
                  class="q-mr-xs"
                />
                {{ t('packsGameVersion') }}
              </div>
              <div class="stats-bar__value">
                <template v-if="packRegistry.availableUpdates[selectedPack.id] && installedGameVersion && installedGameVersion !== selectedPack.gameVersion">
                  <span class="text-grey-5 text-weight-medium">v{{ installedGameVersion }}</span>
                  <QIcon
                    name="arrow_forward"
                    size="12px"
                    color="secondary"
                  />
                  <span class="text-secondary text-weight-bold">v{{ selectedPack.gameVersion }}</span>
                </template>
                <template v-else>
                  <span class="text-white text-weight-medium">v{{ selectedPack.gameVersion }}</span>
                </template>
              </div>
            </div>

            <div class="stats-bar__divider" />

            
            <div class="stats-bar__stat">
              <div class="stats-bar__label">
                <QIcon
                  name="storage"
                  size="12px"
                  class="q-mr-xs"
                />
                {{ t('packsTotalSize') }}
              </div>
              <div class="stats-bar__value">
                <template v-if="packRegistry.availableUpdates[selectedPack.id] && installedTotalSize && installedTotalSize !== selectedPack.totalSizeBytes">
                  <span class="text-grey-5 text-weight-medium">{{ packRegistry.formatBytes(installedTotalSize) }}</span>
                  <QIcon
                    name="arrow_forward"
                    size="12px"
                    color="secondary"
                  />
                  <span class="text-secondary text-weight-bold">{{ packRegistry.formatBytes(selectedPack.totalSizeBytes) }}</span>
                </template>
                <template v-else>
                  <span class="text-white text-weight-medium">{{ packRegistry.formatBytes(selectedPack.totalSizeBytes) }}</span>
                </template>
              </div>
            </div>
          </div>

          <QCardSection class="q-pa-lg q-pt-md">
            <div
              v-if="selectedDownloadState && selectedDownloadState.status === 'error'"
              class="q-pa-md bg-red-10 text-red-2 rounded-borders q-mb-lg row items-start q-gutter-sm"
            >
              <QIcon
                name="error"
                size="20px"
              />
              <div class="col">
                <div class="text-weight-bold">
                  {{ t('packsStatusError') }}
                </div>
                <div class="text-caption">
                  {{ selectedDownloadState.error }}
                </div>
              </div>
            </div>

            <QSeparator class="q-my-md" />
            <div class="roster-section">
              <template v-if="newCharacters.length > 0">
                <div class="row items-center justify-between q-mb-md">
                  <div class="text-subtitle1 text-weight-bold text-white">
                    <QIcon
                      name="new_releases"
                      size="20px"
                      class="q-mr-xs text-secondary"
                    />
                    {{ t('packsNewCharactersTitle') }}
                  </div>
                  <div class="text-caption text-grey-5">
                    {{ newCharacters.length }} {{ t('packsManifestCharacters') }}
                  </div>
                </div>
                <div class="roster-grid q-mb-lg">
                  <QCard
                    v-for="char in newCharacters"
                    :key="char.slug"
                    class="glass-panel char-card text-center"
                    :class="{ 'cursor-pointer': !imageLoadErrors[char.slug] }"
                    @click="handleImagePreview(char.name, char.slug)"
                  >
                    <div class="char-avatar-container">
                      <div
                        v-if="imageLoadErrors[char.slug]"
                        class="char-avatar-placeholder"
                        :style="{
                          background: `linear-gradient(135deg, ${selectedPack.palette.start}, ${selectedPack.palette.end})`
                        }"
                      >
                        <span class="placeholder-text">{{ getInitials(char.name) }}</span>
                      </div>
                      <img
                        v-else
                        :src="getCharacterImageUrl(char.slug, true)"
                        class="char-avatar-img"
                        alt=""
                        decoding="async"
                        @error="handleThumbError(char.slug, $event)"
                      >
                      <QBadge
                        v-if="char.dlc"
                        color="orange"
                        floating
                        class="dlc-badge text-weight-bold"
                      >
                        DLC
                      </QBadge>
                    </div>
                    <div class="char-name-container q-pa-sm">
                      <div class="char-name text-weight-bold text-white text-caption">
                        {{ char.name }}
                        <QTooltip>{{ char.name }}</QTooltip>
                      </div>
                    </div>
                  </QCard>
                </div>
                <QSeparator
                  class="q-my-md"
                  color="dark-separator"
                />
              </template>

              <div class="row items-center justify-between q-mb-md">
                <div class="text-subtitle1 text-weight-bold text-white">
                  {{ t('packsRosterTitle') }}
                </div>
                <div class="text-caption text-grey-5">
                  {{ selectedPack.characterCount }} {{ t('packsManifestCharacters') }}
                </div>
              </div>
              <div
                v-if="isLoadingManifest"
                class="flex flex-center q-py-lg"
              >
                <QSpinnerColor
                  color="primary"
                  size="2em"
                />
              </div>
              <div
                v-else-if="selectedManifest"
                class="roster-grid"
              >
                <QCard
                  v-for="char in selectedManifest.characters"
                  :key="char.slug"
                  class="glass-panel char-card text-center"
                  :class="{ 'cursor-pointer': !imageLoadErrors[char.slug] }"
                  @click="handleImagePreview(char.name, char.slug)"
                >
                  <div class="char-avatar-container">
                    <div
                      v-if="imageLoadErrors[char.slug]"
                      class="char-avatar-placeholder"
                      :style="{
                        background: `linear-gradient(135deg, ${selectedPack.palette.start}, ${selectedPack.palette.end})`
                      }"
                    >
                      <span class="placeholder-text">{{ getInitials(char.name) }}</span>
                    </div>
                    <img
                      v-else
                      :src="getCharacterImageUrl(char.slug, true)"
                      class="char-avatar-img"
                      alt=""
                      decoding="async"
                      @error="handleThumbError(char.slug, $event)"
                    >
                    <QBadge
                      v-if="char.dlc"
                      color="orange"
                      floating
                      class="dlc-badge text-weight-bold"
                    >
                      DLC
                    </QBadge>
                  </div>
                  <div class="char-name-container q-pa-sm">
                    <div class="char-name text-weight-bold text-white text-caption">
                      {{ char.name }}
                      <QTooltip>{{ char.name }}</QTooltip>
                    </div>
                  </div>
                </QCard>
              </div>
            </div>
          </QCardSection>
        </QCard>
      </div>
    </div>
    <QDialog
      v-model="isImagePreviewOpen"
      backdrop-filter="blur(8px)"
    >
      <QCard class="image-preview-card glass-panel text-white q-pa-sm text-center">
        <QCardSection class="q-pb-none row items-center justify-between">
          <div class="text-subtitle1 text-weight-bold">
            {{ previewCharName }}
          </div>
          <QBtn
            v-close-popup
            flat
            round
            dense
            icon="close"
            color="white"
            class="subtle-action-btn"
          />
        </QCardSection>
        <QCardSection class="q-pa-md flex flex-center">
          <img
            :src="previewImageUrl"
            class="preview-img"
            alt=""
            @error="isImagePreviewOpen = false"
          >
        </QCardSection>
      </QCard>
    </QDialog>
  </QPage>
</template>

<style scoped>
.packs-page {
  padding: 64px 24px 24px 24px;
}

.filter-tabs :deep(.q-tab) {
  padding: 0 12px;
  min-height: 36px;
}

.updates-badge {
  position: relative;
  top: -2px;
  right: -4px;
}

.pack-item {
  transition: background-color 0.2s ease;
}

.pack-item:hover {
  background-color: var(--bg-subtle);
}

.selected-pack-item {
  background-color: var(--bg-subtle);
  border-left: 3px solid var(--q-primary);
}

.pack-mini-banner {
  width: 120px;
  height: 48px;
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.pack-mini-header {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pack-mini-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px 8px;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5));
}

.pack-mini-icon {
  position: absolute;
  opacity: 0.12;
}

.empty-detail-card {
  height: 100%;
  min-height: 400px;
  border-style: dashed;
}

.empty-detail-message {
  max-width: 280px;
  margin: 0 auto;
}

.empty-icon {
  opacity: 0.5;
}

.stats-bar {
  display: flex;
  align-items: center;
  gap: 0;
  background: #1a1a1f;
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 20px;
  min-height: 60px;
}

.stats-bar__action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 20px;
  border-right: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.stats-bar__primary-btn {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  min-height: 36px;
  padding: 0 16px;
}

.stats-bar__installed-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stats-bar__uninstall-btn {
  opacity: 0.45;
  transition: opacity 0.2s ease, transform 0.15s ease;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.stats-bar__uninstall-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.stats-bar__uninstall-btn--confirming {
  opacity: 1 !important;
  animation: pulse-warning 1s infinite;
}

@keyframes pulse-warning {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 82, 82, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(255, 82, 82, 0); }
}

.stats-bar__stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 20px;
  flex-shrink: 0;
}

.stats-bar__stat--downloading {
  min-width: 180px;
  justify-content: center;
  padding-right: 30px;
  gap: 2px;
}

.stats-bar__download-label {
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  color: var(--text-base);
}

.stats-bar__download-progress-text {
  font-size: 0.65rem;
  margin-bottom: 2px;
}

.stats-bar__progress {
  border-radius: 2px;
  background: var(--bg-subtle);
}

.stats-bar__label {
  display: flex;
  align-items: center;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  white-space: nowrap;
}

.stats-bar__value {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  white-space: nowrap;
}

.stats-bar__divider {
  width: 1px;
  height: 28px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.detail-banner {
  height: 280px;
  position: relative;
  overflow: hidden;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.banner-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.banner-content-layer {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(0deg, rgba(18, 18, 24, 0.98) 0%, rgba(18, 18, 24, 0.7) 15%, transparent 60%);
}

.banner-noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 0;
}

.banner-logo-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  transition: all 0.3s ease;
}

.banner-logo-wrap.align-bottom-left {
  align-items: flex-end;
  justify-content: flex-start;
  padding-bottom: 16px;
}

.logo-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.detail-logo {
  max-width: 260px;
  max-height: 110px;
  width: auto;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.8));
}

.align-bottom-left .detail-logo {
  max-width: 300px;
  max-height: 140px;
}

.animate-pulse {
  animation: pulse-border 1.5s infinite;
}

@keyframes pulse-border {
  0% {
    box-shadow: 0 0 0 0 rgba(33, 186, 69, 0.6);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(33, 186, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(33, 186, 69, 0);
  }
}

.roster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}

.char-card {
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.char-card:hover {
  transform: translateY(-2px);
  border-color: var(--q-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.char-avatar-container {
  aspect-ratio: 16/10;
  position: relative;
  overflow: hidden;
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-subtle);
}

.char-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.char-avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.dlc-badge {
  top: 4px;
  right: 4px;
  padding: 2px 4px;
  font-size: 0.65rem;
}

.char-name-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
}

.char-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.image-preview-card {
  min-width: 320px;
  max-width: 90vw;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
}

.preview-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
</style>
