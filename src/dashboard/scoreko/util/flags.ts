const flagModules = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const getFlagSvgUrl = (countryCode?: string): string | null => {
  if (!countryCode) return null;
  const code = countryCode.toLowerCase().trim();
  const path = `/node_modules/flag-icons/flags/4x3/${code}.svg`;
  return flagModules[path] ?? null;
};
