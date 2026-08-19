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

export const isEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    const valA = objA[key];
    const valB = objB[key];
    if (Object.is(valA, valB)) continue;
    if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
      if (!isEqual(valA, valB)) return false;
    } else {
      return false;
    }
  }

  return true;
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
      
      if (!isEqual(normalized, state.value)) {
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
      
      if (!isEqual(normalized, replicant.data)) {
        replicant.data = normalized;
        replicant.save();
      }
    },
    { deep: true },
  );
};
