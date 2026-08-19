export interface PacksConfig {
  baseUrl: string;
  owner: string;
  repo: string;
  branch: string;
}

export const BUNDLE_NAME = 'scoreko';

export const getPackRawUrl = (config: PacksConfig, repoPath: string): string => {
  if (config.baseUrl.includes('github.com')) {
    return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${repoPath}`;
  }
  return `${config.baseUrl}/${config.owner}/${config.repo}/raw/branch/${config.branch}/${repoPath}`;
};

export const getRegistryUrl = (config: PacksConfig): string => getPackRawUrl(config, 'registry.json');

export const getManifestUrl = (config: PacksConfig, packId: string): string =>
  getPackRawUrl(config, `${packId}/manifest.json`);

export const getPackLogoUrl = (config: PacksConfig, packId: string): string =>
  getPackRawUrl(config, `${packId}/logo.webp`);

export const getPackHeroUrl = (config: PacksConfig, packId: string): string =>
  getPackRawUrl(config, `${packId}/hero.webp`);

export const getPackHeaderUrl = (config: PacksConfig, packId: string): string =>
  getPackRawUrl(config, `${packId}/header.webp`);

export const getCharacterImageRepoUrl = (config: PacksConfig, packId: string, slug: string, ext: string): string =>
  getPackRawUrl(config, `${packId}/characters/${slug}.${ext}`);

export const getInstalledCharacterImageUrl = (packId: string, slug: string, ext = 'webp'): string =>
  `/packs/${packId}/characters/${slug}.${ext}`;