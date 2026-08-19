import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { commentaryReplicant } from '../../../browser_shared/replicants';
import type { Schemas } from '../../../types';
import { syncStateWithReplicant } from './store-sync';

type Commentary = Schemas.Commentary;

const defaultCommentary: Commentary = {
  leftCommentator: '',
  leftCommentatorTwitter: '',
  rightCommentator: '',
  rightCommentatorTwitter: '',
};

const normalizeCommentary = (input: unknown): Commentary => {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return {
    leftCommentator: typeof candidate.leftCommentator === 'string' ? candidate.leftCommentator : '',
    leftCommentatorTwitter: typeof candidate.leftCommentatorTwitter === 'string' ? candidate.leftCommentatorTwitter : '',
    rightCommentator: typeof candidate.rightCommentator === 'string' ? candidate.rightCommentator : '',
    rightCommentatorTwitter: typeof candidate.rightCommentatorTwitter === 'string' ? candidate.rightCommentatorTwitter : '',
  };
};

export const useCommentaryStore = defineStore('commentary', () => {
  const commentary = ref<Commentary>({ ...defaultCommentary });
  const replicant = commentaryReplicant;
  syncStateWithReplicant(commentary, replicant, normalizeCommentary);

  const leftCommentator = computed({
    get: () => commentary.value.leftCommentator,
    set: (value: string) => {
      commentary.value = {
        ...commentary.value,
        leftCommentator: value,
      };
    },
  });

  const leftCommentatorTwitter = computed({
    get: () => commentary.value.leftCommentatorTwitter,
    set: (value: string) => {
      commentary.value = {
        ...commentary.value,
        leftCommentatorTwitter: value,
      };
    },
  });

  const rightCommentator = computed({
    get: () => commentary.value.rightCommentator,
    set: (value: string) => {
      commentary.value = {
        ...commentary.value,
        rightCommentator: value,
      };
    },
  });

  const rightCommentatorTwitter = computed({
    get: () => commentary.value.rightCommentatorTwitter,
    set: (value: string) => {
      commentary.value = {
        ...commentary.value,
        rightCommentatorTwitter: value,
      };
    },
  });

  const swapCommentators = () => {
    commentary.value = {
      leftCommentator: commentary.value.rightCommentator,
      leftCommentatorTwitter: commentary.value.rightCommentatorTwitter,
      rightCommentator: commentary.value.leftCommentator,
      rightCommentatorTwitter: commentary.value.leftCommentatorTwitter,
    };
  };

  return {
    commentary,
    leftCommentator,
    leftCommentatorTwitter,
    rightCommentator,
    rightCommentatorTwitter,
    swapCommentators,
  };
});
