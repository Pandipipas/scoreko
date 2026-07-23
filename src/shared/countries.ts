import { getData, type CountryRecord } from 'country-list';

export interface CountryOption {
  value: string;
  label: string;
}

const baseCountries = getData();

const optionsCache = new Map<string, CountryOption[]>();

const getDisplayNames = (locale: string) => {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    return null;
  }
};

export const getCountryOptions = (locale = 'en'): CountryOption[] => {
  if (optionsCache.has(locale)) {
    return optionsCache.get(locale)!;
  }

  const displayNames = getDisplayNames(locale);
  const options = baseCountries
    .map((country: CountryRecord) => ({
      value: country.code,
      label: displayNames?.of(country.code) ?? country.name,
    }))
    .sort((a: CountryOption, b: CountryOption) => a.label.localeCompare(b.label));

  optionsCache.set(locale, options);
  return options;
};

const countryByCode = new Map(
  baseCountries.map((country) => [country.code.toUpperCase(), country.name]),
);
const countryByName = new Map(
  baseCountries.map((country) => [country.name.toLowerCase(), country.code]),
);

export const resolveCountryCode = (value?: string) => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const upper = trimmed.toUpperCase();
  if (countryByCode.has(upper)) {
    return upper;
  }
  const byName = countryByName.get(trimmed.toLowerCase());
  return byName ?? '';
};

export const getCountryLabel = (value?: string, locale = 'en') => {
  if (!value) {
    return '';
  }
  const resolved = resolveCountryCode(value);
  if (!resolved) {
    return value;
  }

  const match = getCountryOptions(locale).find((country) => country.value === resolved);
  return match?.label ?? countryByCode.get(resolved) ?? value;
};
