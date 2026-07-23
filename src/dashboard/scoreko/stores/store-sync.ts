import { watch, type Ref } from 'vue';

interface ReplicantLike<T> {
  data: T | undefined;
  save: () => void;
}

export const readStorageSnapshot = <T>(
  storageKey: string,
  normalize: (input: unknown) => T,
): T | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};

export const writeStorageSnapshot = <T>(storageKey: string, value: T): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    
  }
};

export const syncStateWithReplicant = <T>(
  state: Ref<T>,
  replicant: ReplicantLike<T> | undefined,
  normalize: (input: unknown) => T,
  storageKey?: string,
): void => {
  const persistSnapshot = (value: T): void => {
    if (!storageKey) {
      return;
    }
    writeStorageSnapshot(storageKey, value);
  };

  watch(
    () => replicant?.data,
    (value) => {
      if (!value) {
        return;
      }

      const normalized = normalize(value);
      
      if (JSON.stringify(normalized) !== JSON.stringify(state.value)) {
        state.value = normalized;
      }
      
      persistSnapshot(state.value);
    },
    { deep: true, immediate: true },
  );

  watch(
    state,
    (value) => {
      persistSnapshot(value);

      if (!replicant) {
        return;
      }

      const normalized = normalize(value);
      
      if (JSON.stringify(normalized) !== JSON.stringify(replicant.data)) {
        replicant.data = normalized;
        replicant.save();
      }
    },
    { deep: true },
  );
};
