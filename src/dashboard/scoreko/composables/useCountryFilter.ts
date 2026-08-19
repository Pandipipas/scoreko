import { computed, ref, watch } from 'vue';
import { getCountryLabel, getCountryOptions } from '../../../shared/countries';
import { locale } from '../i18n';

export function useCountryFilter(getOverride: () => string, onClear: () => void) {
  const countryOptions = computed(() => getCountryOptions(locale.value));
  const countryInput = ref('');
  const filteredOptions = ref(countryOptions.value);

  watch(countryOptions, (opts) => {
    filteredOptions.value = opts;
  });

  watch(getOverride, (value) => {
    countryInput.value = getCountryLabel(value, locale.value);
  }, { immediate: true });

  const justFocused = ref(false);
  const manuallyCleared = ref(false);

  const onFocus = () => {
    justFocused.value = true;
    manuallyCleared.value = false;
  };

  const onBlur = () => {
    if (manuallyCleared.value) {
      onClear();
      manuallyCleared.value = false;
    }
  };

  const onFilter = (value: string, update: (fn: () => void) => void) => {
    update(() => {
      if (justFocused.value) {
        justFocused.value = false;
        if (value === '') {
          filteredOptions.value = countryOptions.value;
          return;
        }
      }

      manuallyCleared.value = (value === '');

      const needle = value.toLowerCase().trim();
      filteredOptions.value = needle
        ? countryOptions.value.filter((c) => c.label.toLowerCase().includes(needle))
        : countryOptions.value;
    });
  };

  return { countryInput, filteredOptions, onFilter, onFocus, onBlur };
}
