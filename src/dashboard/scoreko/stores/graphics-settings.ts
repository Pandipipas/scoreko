import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { graphicsSettingsReplicant } from '../../../browser_shared/replicants';
import { syncStateWithReplicant } from './store-sync';
import type { Schemas } from '../../../types';
import { scoreboardSkins } from '../../../shared/scoreboard-skins';
import { commentarySkins } from '../../../shared/commentary-skins';
import { LS_KEYS } from '../../../shared/constants';

export const useGraphicsSettingsStore = defineStore('graphicsSettings', () => {
  const settings = ref<Schemas.GraphicsSettings>({
    scoreboardSkin: 'opeik-runback',
    commentarySkin: 'opeik-commentary',
    locale: 'en',
  });

  const normalizeSettings = (input: unknown): Schemas.GraphicsSettings => {
    const data = input as Partial<Schemas.GraphicsSettings> | undefined;
    
    let safeScoreboardSkin = data?.scoreboardSkin ?? '';
    if (!scoreboardSkins.some(skin => skin.id === safeScoreboardSkin)) {
      safeScoreboardSkin = scoreboardSkins[0]?.id ?? 'opeik-runback';
    }

    let safeCommentarySkin = data?.commentarySkin ?? '';
    if (!commentarySkins.some(skin => skin.id === safeCommentarySkin)) {
      safeCommentarySkin = commentarySkins[0]?.id ?? 'opeik-commentary';
    }

    const safeLocale = (data?.locale === 'en' || data?.locale === 'es') ? data.locale : 'en';

    return {
      scoreboardSkin: safeScoreboardSkin,
      commentarySkin: safeCommentarySkin,
      locale: safeLocale,
    };
  };

  syncStateWithReplicant(
    settings,
    graphicsSettingsReplicant,
    normalizeSettings,
    LS_KEYS.GRAPHICS_SETTINGS
  );

  const scoreboardSkin = computed({
    get: () => settings.value.scoreboardSkin ?? '',
    set: (val: string) => { 
      if (val) settings.value.scoreboardSkin = val; 
    }
  });

  const commentarySkin = computed({
    get: () => settings.value.commentarySkin ?? '',
    set: (val: string) => { 
      if (val) settings.value.commentarySkin = val; 
    }
  });

  return {
    scoreboardSkin,
    commentarySkin,
  };
});
