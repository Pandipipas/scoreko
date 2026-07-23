<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { t } from './i18n';
import { usePacksStore } from './stores/packs';
import { useScoreboardStore } from './stores/scoreboard';
import { isShortcutMatch, useShortcutSettingsStore } from './stores/shortcut-settings';
import { LS_KEYS } from '../../shared/constants';

const LS_KEY = LS_KEYS.SIDEBAR_COLLAPSED;
const isCollapsed = ref(localStorage.getItem(LS_KEY) === 'true');
const drawerWidth = computed(() => (isCollapsed.value ? 60 : 220));
watch(isCollapsed, (val) => localStorage.setItem(LS_KEY, String(val)));
const toggleCollapse = () => { isCollapsed.value = !isCollapsed.value; };

const packRegistry = usePacksStore();
const updateCount = computed(() => packRegistry.updateCount);

const appVersion = import.meta.env.PACKAGE_VERSION as string | undefined;

const logoUrl = new URL('./image.webp', import.meta.url).href;

const mainItems = computed(() => [
  { label: t('menuDashboard'), to: '/', icon: 'dashboard' },
  { label: t('menuGraphics'), to: '/graphics', icon: 'collections' },
  { label: t('menuPacks'), to: '/packs', icon: 'sports_esports' },
  { label: t('menuPlayers'), to: '/players', icon: 'groups' },
  { label: t('menuTournament'), to: '/tournament', icon: 'account_tree' },
]);
const configItems = computed(() => [
  { label: t('menuSettings'), to: '/settings', icon: 'settings' },
  { label: t('menuAbout'), to: '/about', icon: 'info' },
]);

const scoreboardStore       = useScoreboardStore();
const shortcutSettingsStore = useShortcutSettingsStore();

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
};

const onShortcutPress = (event: KeyboardEvent) => {
  if (isEditableTarget(event.target) || document.body.dataset.shortcutRecording === 'true') return;
  const { shortcuts } = shortcutSettingsStore;
  if (isShortcutMatch(event, shortcuts.leftIncrement))  { scoreboardStore.incrementLeftScore();  event.preventDefault(); return; }
  if (isShortcutMatch(event, shortcuts.leftDecrement))  { scoreboardStore.decrementLeftScore();  event.preventDefault(); return; }
  if (isShortcutMatch(event, shortcuts.rightIncrement)) { scoreboardStore.incrementRightScore(); event.preventDefault(); return; }
  if (isShortcutMatch(event, shortcuts.rightDecrement)) { scoreboardStore.decrementRightScore(); event.preventDefault(); return; }
  if (isShortcutMatch(event, shortcuts.swapSides))      { scoreboardStore.swapPlayers();         event.preventDefault(); }
};

onMounted(() => {
  window.addEventListener('keydown', onShortcutPress);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onShortcutPress);
});
</script>

<template>
  <QLayout view="lHh LpR fFf">
    <QDrawer
      show-if-above
      side="left"
      :width="drawerWidth"
    >
      <div class="column fit sidebar-inner glass-panel">
        <div
          class="sidebar-header"
          :class="{ 'is-collapsed': isCollapsed }"
        >
          <img
            :src="logoUrl"
            alt="Logo"
            class="sidebar-logo"
          >

          <Transition name="slide-fade">
            <div
              v-if="!isCollapsed"
              class="sidebar-title"
            >
              <span class="title-text">Scoreko</span>
              <span
                v-if="appVersion"
                class="title-version"
              >v{{ appVersion }}</span>
            </div>
          </Transition>
          <QBtn
            flat
            round
            dense
            size="sm"
            :icon="isCollapsed ? 'chevron_right' : 'chevron_left'"
            class="collapse-btn"
            @click="toggleCollapse"
          />
        </div>

        <div class="sidebar-scroll-area">
          <QList
            padding
            class="sidebar-list"
          >
            <QItem
              v-for="item in mainItems"
              :key="item.to"
              clickable
              :to="item.to"
              exact
              active-class="sidebar-item-active"
              class="sidebar-item"
              :class="{ 'nav-item-collapsed': isCollapsed }"
            >
              <QItemSection
                avatar
                class="sidebar-item-icon"
              >
                <QIcon
                  :name="item.icon"
                  size="20px"
                />
              </QItemSection>
              <QItemSection v-if="!isCollapsed">
                <QItemLabel class="row no-wrap items-center justify-between">
                  <span class="sidebar-item-label">{{ item.label }}</span>
                  <QBadge
                    v-if="item.to === '/packs' && updateCount > 0"
                    color="secondary"
                    rounded
                    class="q-ml-sm"
                  >
                    {{ updateCount }}
                  </QBadge>
                </QItemLabel>
              </QItemSection>
              <QBadge
                v-if="isCollapsed && item.to === '/packs' && updateCount > 0"
                color="secondary"
                floating
                rounded
                class="sidebar-collapsed-badge"
              />
              <QTooltip
                v-if="isCollapsed"
                anchor="center right"
                self="center left"
                :offset="[10, 0]"
                class="glass-tooltip"
              >
                {{ item.label }}
                <template v-if="item.to === '/packs' && updateCount > 0">
                  ({{ t('packsStatusUpdateAvailable') }}: {{ updateCount }})
                </template>
              </QTooltip>
            </QItem>
          </QList>
          
          <QList
            padding
            class="sidebar-list"
            style="margin-top: auto;"
          >
            <QItem
              v-for="item in configItems"
              :key="item.to"
              clickable
              :to="item.to"
              exact
              active-class="sidebar-item-active"
              class="sidebar-item"
              :class="{ 'nav-item-collapsed': isCollapsed }"
            >
              <QItemSection
                avatar
                class="sidebar-item-icon"
              >
                <QIcon
                  :name="item.icon"
                  size="20px"
                />
              </QItemSection>
              <QItemSection v-if="!isCollapsed">
                <QItemLabel class="row no-wrap items-center justify-between">
                  <span class="sidebar-item-label">{{ item.label }}</span>
                </QItemLabel>
              </QItemSection>
              <QTooltip
                v-if="isCollapsed"
                anchor="center right"
                self="center left"
                :offset="[10, 0]"
                class="glass-tooltip"
              >
                {{ item.label }}
              </QTooltip>
            </QItem>
          </QList>
        </div>
      </div>
    </QDrawer>

    <QPageContainer>
      <RouterView />
    </QPageContainer>
  </QLayout>
</template>

<style lang="scss">
@import './styles/theme.scss';
@import './styles/glass-panel.scss';
</style>

<style scoped>
:deep(aside.q-drawer) {
  background: transparent !important;
}

.sidebar-inner.glass-panel {
  border-radius: 0 !important;
  border-right: 1px solid var(--border-subtle);
  border-top: none;
  border-bottom: none;
  border-left: none;
}

.sidebar-inner {
  padding: 8px 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px 24px 20px;
  position: relative;
  flex-shrink: 0;
  transition: padding 0.25s ease;
}
.sidebar-header.is-collapsed {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 8px;
}

.sidebar-logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 6px;
}

.sidebar-title {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}
.title-text {
  font-size: 1.05rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}
.title-version {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-top: 2px;
}

.collapse-btn {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.6;
  transition: opacity 0.2s ease, transform 0.25s ease, background 0.2s ease;
}
.collapse-btn:hover {
  opacity: 1;
  background: var(--bg-subtle);
}
.sidebar-header:not(.is-collapsed) .collapse-btn {
  margin-left: auto;
}

.sidebar-scroll-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}
.sidebar-scroll-area::-webkit-scrollbar {
  width: 4px;
}
.sidebar-scroll-area::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 4px;
}

.sidebar-section-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 8px 24px 8px 24px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.sidebar-list {
  padding: 0;
}

.sidebar-item {
  margin: 4px 12px;
  border-radius: 8px;
  min-height: 44px;
  padding: 0 12px;
  color: var(--text-muted);
  transition: background 0.2s ease, color 0.2s ease;
}

.sidebar-item:before {
  display: none;
}

.sidebar-item:hover {
  background: var(--bg-subtle);
  color: var(--text-base);
}

.sidebar-item-active,
.sidebar-item-active:hover {
  background: rgba(230, 107, 60, 0.15);
  color: var(--q-primary);
  font-weight: 500;
}

.sidebar-item-icon {
  min-width: unset;
  padding-right: 12px;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}
.sidebar-item-active .sidebar-item-icon {
  opacity: 1;
}

.sidebar-item-label {
  font-size: 0.9rem;
}

.nav-item-collapsed {
  margin: 8px auto;
  width: 44px;
  height: 44px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}
.nav-item-collapsed .sidebar-item-icon {
  padding-right: 0;
}

.sidebar-item-active .sidebar-item-icon {
  opacity: 1;
}

.sidebar-collapsed-badge {
  top: 6px !important;
  right: 6px !important;
  width: 8px;
  height: 8px;
  min-height: unset;
  padding: 0;
  border-radius: 50%;
}

.glass-tooltip {
  background: rgba(30, 30, 34, 0.9) !important;
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-subtle);
  color: var(--text-base);
  font-size: 0.8rem;
  padding: 6px 10px;
  border-radius: 6px;
}

:global(body.q-body--prevent-scroll) {
  position: relative !important;
  top: 0 !important;
  left: 0 !important;
}
</style>