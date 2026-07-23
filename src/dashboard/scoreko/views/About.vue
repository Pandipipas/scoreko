<script setup lang="ts">
import { useHead } from '@unhead/vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { t } from '../i18n';

defineOptions({ name: 'AboutView' });

useHead(() => ({ title: t('aboutTitle') }));

const route = useRoute();
const router = useRouter();

const activeTab = ref(
  route.hash === '#credits' ? 'credits' : route.hash === '#changelog' ? 'changelog' : 'general',
);

watch(activeTab, (newTab) => {
  router.replace({ hash: newTab === 'general' ? '' : `#${newTab}` });
});

const appName = 'Scoreko';
const currentVersion = import.meta.env.PACKAGE_VERSION;

const socialLinks = [
  { label: 'Twitter', url: 'https://x.com/Pandipipas/', icon: 'fab fa-x-twitter', color: 'grey-4' },
  { label: 'Discord', url: 'https://discord.gg/5QCHcbvV5b/', icon: 'fab fa-discord', color: 'indigo-3' },
  { label: 'GitHub', url: 'https://github.com/Pandipipas/', icon: 'fab fa-github', color: 'grey-4' },
];

const actionLinks = [
  { label: 'Report a Bug', url: 'https://github.com/Pandipipas/scoreko/issues/new?template=bug_report.yml', icon: 'bug_report', color: 'negative', btnClass: 'negative-action-btn', flat: false },
  { label: 'Request Feature', url: 'https://github.com/Pandipipas/scoreko/issues/new?template=feature_request.yml', icon: 'auto_awesome', color: 'primary', btnClass: 'primary-action-btn', flat: false },
  { label: 'Documentation', url: 'https://github.com/Pandipipas/scoreko#readme', icon: 'menu_book', color: 'info', btnClass: 'subtle-action-btn', flat: true },
  { label: 'Contribute', url: 'https://github.com/Pandipipas/scoreko/blob/main/CONTRIBUTING.md', icon: 'handshake', color: 'secondary', btnClass: 'subtle-action-btn', flat: true },
];

const acknowledgments = [
  {
    name: 'NodeCG',
    role: 'Broadcast graphics framework',
    url: 'https://github.com/nodecg/nodecg',
    avatar: 'https://github.com/nodecg.png',
  },
  {
    name: 'zoton2',
    role: 'Base template for the bundle (nodecg-vue-ts-template)',
    url: 'https://github.com/zoton2/nodecg-vue-ts-template',
    avatar: 'https://github.com/zoton2.png',
  },
  {
    name: 'opeik',
    role: 'Inspiration, scoreboard and commentary skins (runback)',
    url: 'https://github.com/opeik/runback',
    avatar: 'https://github.com/opeik.png',
  },
  {
    name: 'Dan Shields',
    role: 'nodecg-vue-composable helper',
    url: 'https://github.com/Dan-Shields/nodecg-vue-composable',
    avatar: 'https://github.com/Dan-Shields.png',
  },
];

const techStack = [
  { label: 'NodeCG', icon: 'layers' },
  { label: 'Vue 3', icon: 'hub' },
  { label: 'Quasar', icon: 'style' },
  { label: 'Electron', icon: 'desktop_windows' },
  { label: 'TypeScript', icon: 'data_object' },
  { label: 'Vite', icon: 'bolt' },
];

const currentYear = new Date().getFullYear();

interface ReleaseItem {
  id: number;
  name: string;
  tag_name: string;
  htmlBody: string;
}
const changelogReleases = ref<ReleaseItem[]>([]);
const isChangelogLoading = ref(true);
const changelogError = ref('');

const contributors = ref<{ login: string; avatar_url: string; html_url: string }[]>([]);
const isContributorsLoading = ref(true);

const fetchReleases = async () => {
  try {
    const res = await fetch('https://api.github.com/repos/Pandipipas/scoreko/releases', {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('Failed to fetch releases');
    
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Invalid content type');
    }

    const releases = await res.json();
    if (!Array.isArray(releases)) {
      throw new Error('Invalid response format');
    }

    const parsedReleases = [];
    for (const release of releases.slice(0, 10)) {
      const rawHtml = await marked.parse(release.body || '', { async: true });
      parsedReleases.push({
        id: release.id,
        name: release.name || release.tag_name,
        tag_name: release.tag_name,
        htmlBody: DOMPurify.sanitize(rawHtml),
      });
    }
    changelogReleases.value = parsedReleases;
  } catch (err) {
    console.error(err);
    changelogError.value = t('aboutChangelogError');
  } finally {
    isChangelogLoading.value = false;
  }
};

const fetchContributors = async () => {
  try {
    const res = await fetch('https://api.github.com/repos/Pandipipas/scoreko/contributors');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        contributors.value = data;
      }
    }
  } catch (err) {
    console.error('Failed to load contributors', err);
  } finally {
    isContributorsLoading.value = false;
  }
};

onMounted(() => {
  fetchReleases();
  fetchContributors();
});
</script>

<template>
  <QPage class="about-page">
    <div class="about-layout">
      <div class="text-center q-mb-xl">
        <QImg
          src="../image.webp"
          alt="Scoreko logo"
          class="app-logo q-mb-md"
          fit="contain"
        />
        <div
          class="text-h4 text-weight-bold q-mb-sm"
          style="color: var(--text-base)"
        >
          {{ appName }}
        </div>
        <div class="row justify-center items-center q-gutter-sm">
          <QBadge
            outline
            color="primary"
            class="version-badge glass-panel"
            style="border-color: var(--primary)"
          >
            v{{ currentVersion }}
          </QBadge>
          <span style="color: var(--border-medium)">•</span>
          <span
            class="text-caption"
            style="color: var(--text-muted)"
          >© {{ currentYear }} Pandipipas</span>
        </div>
      </div>

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
          :label="t('aboutGeneralTab')"
          no-caps
        />
        <QTab
          name="credits"
          :label="t('aboutCreditsTab')"
          no-caps
        />
        <QTab
          name="changelog"
          :label="t('aboutChangelogTab')"
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
          <div class="glass-panel q-pa-md">
            <div
              class="text-subtitle1 text-weight-medium q-mb-sm"
              style="color: var(--text-base)"
            >
              {{ t('aboutProjectInfoTitle') }}
            </div>
            <div
              class="text-body2 q-mb-md"
              style="color: var(--text-muted)"
            >
              {{ t('aboutProjectInfoDesc') }}
            </div>
            <div
              class="text-caption"
              style="color: var(--text-muted)"
            >
              {{ t('aboutLicenseText') }}
              <a
                href="https://github.com/Pandipipas/scoreko/blob/main/LICENSE"
                target="_blank"
                class="text-primary text-decoration-none text-weight-medium"
              >GPL-3.0 License</a>.
            </div>
          </div>

          <div class="glass-panel q-pa-md">
            <div
              class="text-subtitle1 text-weight-medium q-mb-sm"
              style="color: var(--text-base)"
            >
              {{ t('aboutActionsTitle') }}
            </div>
            <div
              class="text-caption q-mb-md"
              style="color: var(--text-muted)"
            >
              {{ t('aboutActionsDesc') }}
            </div>
            <div class="row q-gutter-sm">
              <QBtn
                v-for="action in actionLinks"
                :key="action.label"
                :href="action.url"
                target="_blank"
                :icon="action.icon"
                :label="action.label"
                :color="action.color"
                :unelevated="!action.flat"
                :flat="action.flat"
                no-caps
                :class="action.btnClass"
              />
            </div>

            <QSeparator
              class="q-my-md"
              style="background: var(--border-subtle)"
            />

            <div
              class="text-subtitle1 text-weight-medium q-mb-sm"
              style="color: var(--text-base)"
            >
              {{ t('aboutSocialsTitle') }}
            </div>
            <div class="row q-gutter-sm">
              <QBtn
                v-for="link in socialLinks"
                :key="link.label"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                :icon="link.icon"
                :label="link.label"
                :color="link.color"
                flat
                no-caps
                class="subtle-action-btn"
              />
            </div>
          </div>
        </QTabPanel>

        <QTabPanel
          name="credits"
          class="column q-gutter-lg q-pa-none"
        >
          <div class="glass-panel q-pa-md">
            <div class="q-mb-md">
              <div
                class="text-caption text-weight-medium q-mb-sm"
                style="color: var(--text-muted)"
              >
                {{ t('aboutContributorsTitle') }}
              </div>
              <div
                v-if="isContributorsLoading"
                class="row q-gutter-sm q-px-sm"
              >
                <QSpinner
                  color="primary"
                  size="2em"
                />
              </div>
              <div
                v-else
                class="row q-gutter-sm q-px-sm"
              >
                <a
                  v-for="contributor in contributors"
                  :key="contributor.login"
                  :href="contributor.html_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="contributor-avatar-link"
                >
                  <QAvatar
                    size="40px"
                    class="cursor-pointer shadow-1"
                  >
                    <img
                      :src="contributor.avatar_url"
                      :alt="contributor.login"
                    >
                    <QTooltip
                      class="glass-panel text-caption"
                      style="background: var(--bg-subtle)"
                    >
                      {{ contributor.login }}
                    </QTooltip>
                  </QAvatar>
                </a>
              </div>
            </div>

            <QSeparator
              class="q-my-md"
              style="background: var(--border-subtle)"
            />

            <div class="q-mb-md">
              <div
                class="text-caption text-weight-medium q-mb-sm"
                style="color: var(--text-muted)"
              >
                {{ t('aboutAcknowledgmentsTitle') }}
              </div>
              <QList
                dense
                class="rounded-borders"
              >
                <QItem
                  v-for="person in acknowledgments"
                  :key="person.name"
                  tag="a"
                  :href="person.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  class="q-px-sm"
                  style="color: var(--text-base)"
                >
                  <QItemSection
                    avatar
                    style="min-width: 32px"
                  >
                    <QAvatar size="32px">
                      <img
                        :src="person.avatar"
                        :alt="person.name"
                      >
                    </QAvatar>
                  </QItemSection>
                  <QItemSection>
                    <QItemLabel class="text-body2 text-weight-medium">
                      {{ person.name }}
                    </QItemLabel>
                    <QItemLabel
                      caption
                      style="color: var(--text-muted)"
                    >
                      {{ person.role }}
                    </QItemLabel>
                  </QItemSection>
                </QItem>
              </QList>
            </div>

            <QSeparator
              class="q-my-md"
              style="background: var(--border-subtle)"
            />

            <div>
              <div
                class="text-caption text-weight-medium q-mb-sm"
                style="color: var(--text-muted)"
              >
                {{ t('aboutTechStackTitle') }}
              </div>
              <div class="row q-gutter-sm">
                <QChip
                  v-for="tech in techStack"
                  :key="tech.label"
                  :icon="tech.icon"
                  :label="tech.label"
                  size="sm"
                  class="text-weight-medium glass-panel"
                  style="background: var(--bg-subtle); color: var(--text-base)"
                />
              </div>
            </div>
          </div>
        </QTabPanel>

        <QTabPanel
          name="changelog"
          class="column q-gutter-lg q-pa-none"
        >
          <div class="glass-panel q-pa-md">
            <div
              v-if="isChangelogLoading"
              class="row justify-center q-pa-md"
            >
              <QSpinner
                color="primary"
                size="3em"
              />
            </div>
            <div
              v-else-if="changelogError"
              class="text-negative text-center q-pa-md"
            >
              {{ changelogError }}
            </div>
            <QList
              v-else
              class="rounded-borders"
            >
              <QExpansionItem
                v-for="(release, index) in changelogReleases"
                :key="release.id"
                class="q-mb-sm glass-panel"
                style="background: var(--bg-subtle)"
              >
                <template #header>
                  <QItemSection>
                    <div class="row items-center q-gutter-x-sm">
                      <span
                        class="text-subtitle1 text-weight-medium"
                        style="color: var(--text-base)"
                      >{{ release.name }}</span>
                      <QBadge
                        v-if="index === 0"
                        outline
                        rounded
                        color="positive"
                        class="glass-panel"
                      >
                        {{ t('aboutLatestBadge') }}
                      </QBadge>
                      <QBadge
                        v-if="release.tag_name && release.tag_name.replace(/^v/, '') === currentVersion.replace(/^v/, '')"
                        outline
                        rounded
                        color="info"
                        class="glass-panel"
                      >
                        {{ t('aboutCurrentBadge') }}
                      </QBadge>
                    </div>
                  </QItemSection>
                </template>
                <QCardSection class="q-pt-sm">
                  <!-- eslint-disable vue/no-v-html -->
                  <div
                    class="changelog-content text-body2"
                    style="color: var(--text-muted)"
                    v-html="release.htmlBody"
                  />
                  <!-- eslint-enable vue/no-v-html -->
                </QCardSection>
              </QExpansionItem>
            </QList>
          </div>
        </QTabPanel>
      </QTabPanels>
    </div>
  </QPage>
</template>

<style scoped>
.about-page {
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.about-layout {
  max-width: 680px;
  width: 100%;
}

.app-logo {
  width: 90px;
  height: 90px;
  margin: 0 auto;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
}

.version-badge {
  font-size: 13px;
  padding: 4px 10px;
  letter-spacing: 0.03em;
  font-family: var(--font-mono);
}

.contributor-avatar-link {
  transition: transform 0.2s ease, filter 0.2s ease;
  display: block;
}

.contributor-avatar-link:hover {
  transform: translateY(-2px);
  filter: brightness(1.2);
}

.changelog-content :deep(h1),
.changelog-content :deep(h2) {
  font-size: 1.5rem;
  line-height: 2rem;
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 4px;
  font-weight: 500;
  color: var(--text-base);
}

.changelog-content :deep(h3) {
  font-size: 1.25rem;
  line-height: 1.75rem;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-base);
}

.changelog-content :deep(p) {
  margin-bottom: 1rem;
}

.changelog-content :deep(ul),
.changelog-content :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 2rem;
}

.changelog-content :deep(li) {
  margin-bottom: 0.25rem;
}

.changelog-content :deep(a) {
  color: var(--q-primary);
  text-decoration: none;
}

.changelog-content :deep(a:hover) {
  text-decoration: underline;
}

.changelog-content :deep(code) {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 2px 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.changelog-content :deep(pre) {
  background: var(--bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.9em;
}
</style>