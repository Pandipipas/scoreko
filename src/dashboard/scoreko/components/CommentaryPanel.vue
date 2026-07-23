<script setup lang="ts">
defineOptions({ name: 'CommentaryPanel' });
import { computed } from 'vue';
import { t } from '../i18n';
import { useCommentaryStore } from '../stores/commentary';

const commentaryStore = useCommentaryStore();

const TWITTER_MAX_LENGTH = 15;
const TWITTER_VALID_CHARS = /^[A-Za-z0-9_]*$/;

const twitterRules = [
  (val: string) =>
    !val || val.length <= TWITTER_MAX_LENGTH || t('commentaryTwitterMaxLength'),
  (val: string) =>
    !val || TWITTER_VALID_CHARS.test(val) || t('commentaryTwitterInvalidChars'),
];

function stripAt(value: string): string {
  return value.startsWith('@') ? value.slice(1) : value;
}

function handleLeftTwitterInput(value: string | number | null) {
  commentaryStore.leftCommentatorTwitter = value ? stripAt(String(value)) : '';
}

function handleRightTwitterInput(value: string | number | null) {
  commentaryStore.rightCommentatorTwitter = value ? stripAt(String(value)) : '';
}

function clearAll() {
  commentaryStore.leftCommentator = '';
  commentaryStore.leftCommentatorTwitter = '';
  commentaryStore.rightCommentator = '';
  commentaryStore.rightCommentatorTwitter = '';
}

const isAnythingFilled = computed(() =>
  !!(
    commentaryStore.leftCommentator ||
    commentaryStore.leftCommentatorTwitter ||
    commentaryStore.rightCommentator ||
    commentaryStore.rightCommentatorTwitter
  )
);
</script>

<template>
  <div class="commentary-panel">
    <div class="commentary-panel__grid">
      <div class="commentary-panel__input">
        <QInput
          v-model="commentaryStore.leftCommentator"
          :placeholder="t('commentaryHint1')"
          dense
          outlined
          debounce="300"
          class="dark-input"
        >
          <template #prepend>
            <QIcon
              name="mic"
              size="xs"
            />
          </template>
        </QInput>
      </div>

      <div class="commentary-panel__actions">
        <QBtn
          flat
          dense
          size="sm"
          icon="swap_horiz"
          class="action-btn"
          @click="commentaryStore.swapCommentators"
        >
          <QTooltip>{{ t('commentarySwap') }}</QTooltip>
        </QBtn>
      </div>

      <div class="commentary-panel__input">
        <QInput
          v-model="commentaryStore.rightCommentator"
          :placeholder="t('commentaryHint2')"
          dense
          outlined
          debounce="300"
          class="dark-input"
        >
          <template #prepend>
            <QIcon
              name="mic"
              size="xs"
            />
          </template>
        </QInput>
      </div>

      <div class="commentary-panel__input">
        <QInput
          :model-value="commentaryStore.leftCommentatorTwitter"
          :placeholder="t('commentaryTwitterHint')"
          :rules="twitterRules"
          :maxlength="TWITTER_MAX_LENGTH"
          dense
          outlined
          debounce="300"
          class="dark-input"
          @update:model-value="handleLeftTwitterInput"
        >
          <template #prepend>
            <QIcon
              name="fa-brands fa-twitter"
              size="xs"
            />
          </template>
        </QInput>
      </div>

      <div class="commentary-panel__actions">
        <QBtn
          flat
          dense
          size="sm"
          icon="restart_alt"
          class="action-btn"
          :disable="!isAnythingFilled"
          @click="clearAll"
        >
          <QTooltip>{{ t('commentaryClear') }}</QTooltip>
        </QBtn>
      </div>

      <div class="commentary-panel__input">
        <QInput
          :model-value="commentaryStore.rightCommentatorTwitter"
          :placeholder="t('commentaryTwitterHint')"
          :rules="twitterRules"
          :maxlength="TWITTER_MAX_LENGTH"
          dense
          outlined
          debounce="300"
          class="dark-input"
          @update:model-value="handleRightTwitterInput"
        >
          <template #prepend>
            <QIcon
              name="fa-brands fa-twitter"
              size="xs"
            />
          </template>
        </QInput>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

.commentary-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}

.commentary-panel__grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-rows: auto auto;
  gap: 12px;
  align-items: start;
}

.commentary-panel__input {
  width: 100%;
}

.commentary-panel__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.action-btn {
  color: rgba(255, 255, 255, 0.6);
}

.action-btn:hover {
  color: #fff;
}

</style>