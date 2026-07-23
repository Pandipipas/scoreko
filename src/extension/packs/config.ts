import * as path from 'path';
import { fileURLToPath } from 'url';
import { nodecg } from '../util/nodecg.js';
import { packsConfigReplicant } from '../util/replicants.js';

const bundleConfig = nodecg.bundleConfig;

packsConfigReplicant.value = {
  baseUrl: String(bundleConfig.packsRepoBaseUrl).trim(),
  owner: String(bundleConfig.packsRepoOwner).trim(),
  repo: String(bundleConfig.packsRepoName).trim(),
  branch: String(bundleConfig.packsRepoBranch).trim(),
};

export const PACKS_REPO_BASE_URL = packsConfigReplicant.value.baseUrl;
export const PACKS_REPO_OWNER = packsConfigReplicant.value.owner;
export const PACKS_REPO_NAME = packsConfigReplicant.value.repo;
export const PACKS_REPO_BRANCH = packsConfigReplicant.value.branch;

export const rawUrl = (repoPath: string) => {
  if (PACKS_REPO_BASE_URL.includes('github.com')) {
    return `https://raw.githubusercontent.com/${PACKS_REPO_OWNER}/${PACKS_REPO_NAME}/${PACKS_REPO_BRANCH}/${repoPath}`;
  }
  return `${PACKS_REPO_BASE_URL}/${PACKS_REPO_OWNER}/${PACKS_REPO_NAME}/raw/branch/${PACKS_REPO_BRANCH}/${repoPath}`;
};

export const REGISTRY_URL = rawUrl('registry.json');
export const getManifestUrl = (id: string) => rawUrl(`${id}/manifest.json`);
export const getPackLogoUrl = (id: string) => rawUrl(`${id}/logo.webp`);
export const getPackHeroUrl = (id: string) => rawUrl(`${id}/hero.webp`);
export const getPackHeaderUrl = (id: string) => rawUrl(`${id}/header.webp`);
export const getCharacterImageRepoUrl = (id: string, slug: string, ext: string, suffix = '') =>
  rawUrl(`${id}/characters/${slug}${suffix}.${ext}`);

export const bundleDir = fileURLToPath(new URL('../../', import.meta.url));
export const packsDir = path.join(bundleDir, 'packs');
