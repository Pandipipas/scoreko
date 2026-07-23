<script setup lang="ts">
import { useHead } from '@unhead/vue';
import { computed, ref } from 'vue';
import bundlePackage from '../../../../package.json';
import { useGraphicsSettingsStore } from '../stores/graphics-settings';
import { commentarySkins } from '../../../shared/commentary-skins';
import { scoreboardSkins } from '../../../shared/scoreboard-skins';
import { t } from '../i18n';

defineOptions({ name: 'GraphicsView' });

type GraphicConfig = {
  name?: string;
  title?: string;
  file: string;
  width?: number;
  height?: number;
};

type GraphicCard = {
  id: 'scoreboard' | 'commentary';
  label: string;
  graphic: GraphicConfig;
  skinOptions?: Array<{ label: string; value: string }>;
};

useHead(() => ({ title: t('graphicsTitle') }));

const graphics = computed<GraphicConfig[]>(() => bundlePackage.nodecg?.graphics ?? []);

const baseUrl = computed(() => {
  const bundleName = bundlePackage.name ?? 'bundle';
  return `${window.location.origin}/bundles/${bundleName}/graphics/`;
});

const buildGraphicUrl = (graphic: GraphicConfig) => `${baseUrl.value}${graphic.file}`;

const buildGraphicName = (graphic: GraphicConfig) => {
  const cleaned = graphic.file.replace(/\/?main\.html$/i, '');
  const parts = cleaned.split('/').filter(Boolean);
  return parts.at(-1) ?? graphic.file;
};

const getGraphicKey = (graphic: GraphicConfig) =>
  (graphic.name ?? buildGraphicName(graphic)).toLowerCase();

const canonicalScoreboardGraphic = computed(() => {
  return graphics.value.find(
    (graphic) => getGraphicKey(graphic) === 'scoreboard',
  );
});

const commentaryGraphic = computed(() =>
  graphics.value.find((graphic) => getGraphicKey(graphic).includes('commentary')),
);

const store = useGraphicsSettingsStore();

const cards = computed<GraphicCard[]>(() => {
  const result: GraphicCard[] = [];

  if (canonicalScoreboardGraphic.value) {
    result.push({
      id: 'scoreboard',
      label: t('graphicsScoreboard'),
      graphic: canonicalScoreboardGraphic.value,
      skinOptions: scoreboardSkins.map((skin) => ({
        label: skin.name,
        value: skin.id,
      })),
    });
  }

  if (commentaryGraphic.value) {
    result.push({
      id: 'commentary',
      label: t('graphicsCommentary'),
      graphic: commentaryGraphic.value,
      skinOptions: commentarySkins.map((skin) => ({
        label: skin.name,
        value: skin.id,
      })),
    });
  }

  return result;
});

const copiedCardId = ref<string | null>(null);

const copyUrl = async (graphic: GraphicConfig, cardId: string) => {
  const url = buildGraphicUrl(graphic);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  } else {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }

  copiedCardId.value = cardId;
  setTimeout(() => {
    copiedCardId.value = null;
  }, 2000);
};

const openUrl = (graphic: GraphicConfig) => {
  window.open(buildGraphicUrl(graphic), '_blank');
};

const onDragStart = (event: DragEvent, graphic: GraphicConfig) => {
  const url = buildGraphicUrl(graphic);
  const name = buildGraphicName(graphic);
  const payload = JSON.stringify({
    name,
    url,
    width: graphic.width ?? 1920,
    height: graphic.height ?? 1080,
  });

  event.dataTransfer?.setData('text/uri-list', url);
  event.dataTransfer?.setData('text/plain', url);
  event.dataTransfer?.setData('application/x-obs-browser-source', payload);
  event.dataTransfer?.setData('application/json', payload);
  event.dataTransfer?.setDragImage?.(new Image(), 0, 0);
};
</script>

<template>
  <QPage class="graphics-page">
    <div
      v-if="cards.length === 0"
      class="flex flex-center q-pa-xl border-dashed glass-panel"
      style="color: var(--text-muted);"
    >
      <div class="text-center">
        <QIcon
          name="warning"
          size="3em"
          class="q-mb-md"
        />
        <div class="text-h6">
          {{ t('graphicsNoConfigured') }}
        </div>
      </div>
    </div>
    <div class="row q-col-gutter-lg">
      <div
        v-for="card in cards"
        :key="card.id"
        class="col-12 col-lg-6"
      >
        <QCard
          class="glass-panel full-height column"
        >
          <QCardSection class="row no-wrap items-start">
            <div class="col">
              <div class="text-h5 text-weight-medium q-mb-xs">
                {{ card.label }}
              </div>
            </div>
            <div class="col-auto q-ml-md">
              <QBadge
                color="primary"
                outline
                class="text-subtitle2 q-pa-sm"
              >
                {{ card.graphic.width ?? 1920 }}x{{ card.graphic.height ?? 1080 }}
              </QBadge>
            </div>
          </QCardSection>

          <QSeparator />
          <QCardSection class="col-grow">
            <div
              v-if="card.skinOptions"
              class="q-mb-md"
            >
              <div
                class="text-subtitle2 q-mb-sm"
                style="color: var(--text-muted);"
              >
                {{ t('graphicsSkinAppearance') }}
              </div>
              <QSelect
                v-if="card.id === 'scoreboard'"
                v-model="store.scoreboardSkin"
                dark
                dense
                options-dense
                color="primary"
                popup-content-class="glass-panel glass-dropdown"
                emit-value
                map-options
                class="dark-input"
                :label="t('graphicsSkinLabel')"
                :options="card.skinOptions"
              />
              <QSelect
                v-else-if="card.id === 'commentary'"
                v-model="store.commentarySkin"
                dark
                dense
                options-dense
                color="primary"
                popup-content-class="glass-panel glass-dropdown"
                emit-value
                map-options
                class="dark-input"
                :label="t('graphicsSkinLabel')"
                :options="card.skinOptions"
              />
            </div>
            <div
              v-else
              class="text-caption font-italic"
              style="color: var(--text-muted);"
            >
              {{ t('graphicsSkinNoOptions') }}
            </div>
          </QCardSection>

          <QSeparator />
          <QCardActions
            class="q-pa-md"
            align="right"
          >
            <QBtn
              class="primary-action-btn"
              unelevated
              :color="copiedCardId === card.id ? 'positive' : 'primary'"
              :icon="copiedCardId === card.id ? 'check' : 'content_copy'"
              no-caps
              :label="copiedCardId === card.id ? t('graphicsCopied') : t('graphicsCopyUrl')"
              @click="copyUrl(card.graphic, card.id)"
            />
            <QBtn
              class="subtle-action-btn"
              outline
              color="secondary"
              icon="open_with"
              no-caps
              draggable="true"
              :label="t('graphicsDragObs')"
              @dragstart="onDragStart($event, card.graphic)"
            />
            <QBtn
              class="subtle-action-btn"
              outline
              color="grey-7"
              icon="open_in_new"
              no-caps
              :label="t('graphicsOpenBrowser')"
              @click="openUrl(card.graphic)"
            />
          </QCardActions>
        </QCard>
      </div>
    </div>
  </QPage>
</template>

<style scoped>
.graphics-page {
  padding: 64px 24px 24px 24px;
}

.border-dashed {
  border: 2px dashed var(--border-medium);
  border-radius: 8px;
}

</style>