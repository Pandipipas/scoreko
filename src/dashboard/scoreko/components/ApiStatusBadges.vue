<script setup lang="ts">
import { computed } from 'vue';
import { apiStatusReplicant } from '../../../browser_shared/replicants';
import { RouterLink } from 'vue-router';
import challongeIcon from '../assets/challonge.ico';
import startggIcon from '../assets/startgg.svg';

defineOptions({ name: 'ApiStatusBadges' });

defineProps<{
  isCollapsed: boolean;
}>();

const apiStatus = computed(() => apiStatusReplicant?.data || { startgg: 'disconnected', challonge: 'disconnected' });
</script>

<template>
  <div
    class="api-status-container"
    :class="{ 'is-collapsed': isCollapsed }"
  >
    <RouterLink
      to="/settings#integrations"
      class="status-item"
      :class="apiStatus.startgg"
      title="start.gg Status"
    >
      <div class="logo-wrapper">
        <img
          :src="startggIcon"
          class="platform-logo startgg-logo"
          alt="start.gg"
        >
        <div
          class="status-dot"
          :class="apiStatus.startgg"
        />
      </div>
      <span
        v-if="!isCollapsed"
        class="status-text"
      >start.gg</span>
    </RouterLink>

    <div
      v-if="!isCollapsed"
      class="status-divider"
    />

    <RouterLink
      to="/settings#integrations"
      class="status-item"
      :class="apiStatus.challonge"
      title="Challonge Status"
    >
      <div class="logo-wrapper">
        <img
          :src="challongeIcon"
          class="platform-logo challonge-logo"
          alt="Challonge"
        >
        <div
          class="status-dot"
          :class="apiStatus.challonge"
        />
      </div>
      <span
        v-if="!isCollapsed"
        class="status-text"
      >Challonge</span>
    </RouterLink>
  </div>
</template>

<style lang="scss" scoped>
.api-status-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 8px;
  border-top: 1px solid var(--border-subtle);
  background: transparent;
  
  &.is-collapsed {
    flex-direction: column;
    padding: 16px 8px;
    gap: 20px;
  }
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
}

.logo-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.platform-logo {
  object-fit: contain;
  opacity: 0.4;
  transition: opacity 0.3s ease, filter 0.3s ease;
  filter: grayscale(100%);
}

.startgg-logo {
  height: 11px;
  width: auto;
}

.challonge-logo {
  height: 14px;
  width: auto;
}

.status-item.connected .platform-logo {
  opacity: 1;
  filter: grayscale(0%);
}

.status-item.checking .platform-logo {
  opacity: 0.7;
  animation: pulse-opacity 1.5s infinite;
}

.status-dot {
  position: absolute;
  bottom: -4px;
  right: -6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  box-shadow: 0 0 0 2px var(--bg-subtle);
  transition: all 0.3s ease;

  &.connected {
    background: #10b981;
    box-shadow: 0 0 4px rgba(16, 185, 129, 0.6), 0 0 0 2px var(--bg-subtle);
  }
  
  &.checking {
    background: #f59e0b;
    box-shadow: 0 0 4px rgba(245, 158, 11, 0.6), 0 0 0 2px var(--bg-subtle);
  }
  
  &.error, &.disconnected {
    background: #ef4444;
  }
}

.status-divider {
  width: 1px;
  height: 14px;
  background: var(--border-subtle);
}

.status-text {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.5px;
  transition: color 0.3s ease;
}

.status-item.connected .status-text {
  color: var(--text-base);
}

@keyframes pulse-opacity {
  0% { opacity: 0.4; }
  50% { opacity: 0.8; }
  100% { opacity: 0.4; }
}
</style>
