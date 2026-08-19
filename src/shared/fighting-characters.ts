import type { PackManifest, PackCharacter } from './pack-types.js';

export interface FightingCharacterOption {
  label: string;
  value: string;
  image: string;
  dlc?: boolean;
}

const installedPackCharacters: Record<string, FightingCharacterOption[]> = {};
const installedPackDefaults: Record<string, { leftCharacter: string; rightCharacter: string }> = {};

export const registerInstalledPack = (manifest: PackManifest): void => {
  const { id, name, palette, characters, defaultPair } = manifest;

  installedPackCharacters[name] = characters.map((char: PackCharacter) => ({
    label: char.name,
    value: char.slug,
    image: `/packs/${id}/characters/${char.slug}.webp`,
    dlc: char.dlc ?? false,
  }));

  if (defaultPair) {
    installedPackDefaults[name] = {
      leftCharacter: defaultPair.left,
      rightCharacter: defaultPair.right,
    };
  }
};

export const unregisterInstalledPack = (gameName: string): void => {
  delete installedPackCharacters[gameName];
  delete installedPackDefaults[gameName];
};

export const getCharactersByGame = (game: string): FightingCharacterOption[] =>
  installedPackCharacters[game] ?? [];

export const getDefaultCharactersByGame = (
  game: string,
): { leftCharacter: string; rightCharacter: string } | undefined =>
  installedPackDefaults[game];