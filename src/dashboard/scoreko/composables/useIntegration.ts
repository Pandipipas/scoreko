import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from 'vue';
import type { RecentTournament, ImportedPlayer } from '../../../types';

export interface TemporaryPlayerMeta {
  expiresAt: number;
  tournamentSlug: string;
}

export type TemporaryPlayersMap = Record<string, TemporaryPlayerMeta>;

interface TournamentOption {
  label: string;
  value: string;
  caption: string;
}

interface OAuthSessionResponse {
  sessionId: string;
  authUrl: string;
}

interface OAuthStatusResponse {
  status: 'pending' | 'completed' | 'error' | 'expired';
  token?: string;
  error?: string;
}

export interface PlayersStore {
  upsertPlayer: (id: string, data: Omit<ImportedPlayer, 'id'>) => void;
  removePlayer: (id: string) => void;
}

export interface UseIntegrationOptions {
  
  messagePrefix: string;
  
  providerLabel: string;
  
  tempPlayersStorageKey: string;
  
  tempFallbackDurationSeconds: number;
  
  on401Message?: string;
  
  playersStore: PlayersStore;
}

const sendNodeCGMessage = <T>(messageName: string, payload: unknown): Promise<T> =>
  new Promise((resolve, reject) => {
    nodecg.sendMessage(messageName, payload, (error: unknown, response: unknown) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      resolve(response as T);
    });
  });

const globalTemporaryPlayers = new Map<string, Ref<TemporaryPlayersMap>>();

export function useIntegration(options: UseIntegrationOptions) {
  const {
    messagePrefix,
    providerLabel,
    tempPlayersStorageKey,
    tempFallbackDurationSeconds,
    on401Message,
    playersStore,
  } = options;

  const authState = nodecg.Replicant<Record<string, boolean>>('integration_auth_state');
  const hasTokenConfigured = ref(false);
  const hasValidatedToken = ref(false);

  onMounted(() => {
    nodecg.readReplicant('integration_auth_state', (value: Record<string, boolean> | undefined) => {
      if (value?.[messagePrefix]) {
        hasTokenConfigured.value = true;
      }
    });

    authState.on('change', (newVal: Record<string, boolean> | undefined) => {
      hasTokenConfigured.value = Boolean(newVal?.[messagePrefix]);
    });
  });

  watch(hasTokenConfigured, (configured) => {
    hasValidatedToken.value = false;
    if (!configured) {
      recentTournaments.value = [];
      selectedTournamentSlug.value = '';
      tournamentInput.value = '';
      tournamentsError.value = '';
    } else {
      void loadRecentTournaments();
    }
  });
  const recentTournaments = ref<RecentTournament[]>([]);
  const loadingTournaments = ref(false);
  const tournamentsError = ref('');
  const selectedTournamentSlug = ref('');
  const tournamentInput = ref('');

  const tournamentOptions = computed<TournamentOption[]>(() =>
    recentTournaments.value.map((t) => ({
      label: t.name,
      value: t.slug,
      caption: t.slug,
    })),
  );

  const filteredTournamentOptions = ref<TournamentOption[]>(tournamentOptions.value);

  watch(tournamentOptions, (value) => {
    filteredTournamentOptions.value = value;
  });

  const filterTournaments = (value: string, update: (cb: () => void) => void) => {
    update(() => {
      const needle = value.toLowerCase().trim();
      filteredTournamentOptions.value = needle
        ? tournamentOptions.value.filter(
          (o) =>
            o.label.toLowerCase().includes(needle) ||
            o.caption.toLowerCase().includes(needle),
        )
        : tournamentOptions.value;
    });
  };

  const selectedTournamentOption = computed<RecentTournament | null>(
    () => recentTournaments.value.find((t) => t.slug === selectedTournamentSlug.value) ?? null,
  );

  const canImportSelectedTournament = computed(() => Boolean(selectedTournamentOption.value));

  const loadRecentTournaments = async () => {
    if (!hasTokenConfigured.value) {
      tournamentsError.value = `Add your ${providerLabel} account to load tournaments.`;
      recentTournaments.value = [];
      return;
    }

    tournamentsError.value = '';
    loadingTournaments.value = true;
    try {
      const tournaments = await sendNodeCGMessage<RecentTournament[]>(
        `${messagePrefix}:fetchRecentTournaments`,
        {},
      );
      hasValidatedToken.value = true;
      recentTournaments.value = tournaments;
      if (!tournaments.length) {
        tournamentsError.value = 'There are no recent tournaments for this account.';
      }
    } catch (error) {
      hasValidatedToken.value = false;
      const message = error instanceof Error ? error.message : 'Could not load tournaments.';
      tournamentsError.value =
        on401Message && message.includes('401') ? on401Message : message;
      recentTournaments.value = [];
    } finally {
      loadingTournaments.value = false;
    }
  };
  const players = ref<ImportedPlayer[]>([]);
  const selectedPlayerIds = ref<string[]>([]);
  const importDialogOpen = ref(false);
  const importDialogError = ref('');
  const loadingPlayers = ref(false);
  const importingTournament = ref<RecentTournament | null>(null);

  const openImportDialog = async (tournament: RecentTournament): Promise<void> => {
    importingTournament.value = tournament;
    importDialogOpen.value = true;
    importDialogError.value = '';
    loadingPlayers.value = true;
    selectedPlayerIds.value = [];
    selectedTournamentSlug.value = tournament.slug;
    tournamentInput.value = tournament.name;
    players.value = [];

    try {
      const importedPlayers = await sendNodeCGMessage<ImportedPlayer[]>(
        `${messagePrefix}:fetchTournamentPlayers`,
        { slug: tournament.slug },
      );
      players.value = importedPlayers;
      selectedPlayerIds.value = importedPlayers.map((p) => p.id);
    } catch (error) {
      importDialogError.value =
        error instanceof Error ? error.message : 'Could not load players';
      importDialogOpen.value = false;
    } finally {
      loadingPlayers.value = false;
    }
  };

  const openSelectedTournamentImportDialog = () => {
    if (selectedTournamentOption.value) {
      void openImportDialog(selectedTournamentOption.value);
    }
  };

  const toggleAllPlayers = () => {
    selectedPlayerIds.value =
      selectedPlayerIds.value.length === players.value.length
        ? []
        : players.value.map((p) => p.id);
  };

  const importSelectedPlayers = () => {
    const selected = players.value.filter((p) => selectedPlayerIds.value.includes(p.id));
    const tournament = importingTournament.value;
    const fallbackEndAt =
      (tournament?.startAt ?? Math.floor(Date.now() / 1000)) + tempFallbackDurationSeconds;
    const expiresAt = tournament?.endAt ?? fallbackEndAt;
    const nextMeta = { ...temporaryPlayers.value };

    for (const player of selected) {
      playersStore.upsertPlayer(player.id, {
        gamertag: player.gamertag,
        name: player.name,
        team: player.team,
        country: player.country,
        twitter: player.twitter,
      });
      if (tournament) {
        nextMeta[player.id] = { expiresAt, tournamentSlug: tournament.slug };
      }
    }

    temporaryPlayers.value = nextMeta;
    persistTemporaryPlayers();
    importDialogOpen.value = false;
  };

  const autoImportAllPlayers = async (tournament: RecentTournament): Promise<void> => {
    loadingPlayers.value = true;
    try {
      const importedPlayers = await sendNodeCGMessage<ImportedPlayer[]>(
        `${messagePrefix}:fetchTournamentPlayers`,
        { slug: tournament.slug },
      );
      
      const fallbackEndAt =
        (tournament.startAt ?? Math.floor(Date.now() / 1000)) + tempFallbackDurationSeconds;
      const expiresAt = tournament.endAt ?? fallbackEndAt;
      const nextMeta = { ...temporaryPlayers.value };

      for (const player of importedPlayers) {
        playersStore.upsertPlayer(player.id, {
          gamertag: player.gamertag,
          name: player.name,
          team: player.team,
          country: player.country,
          twitter: player.twitter,
        });
        nextMeta[player.id] = { expiresAt, tournamentSlug: tournament.slug };
      }

      temporaryPlayers.value = nextMeta;
      persistTemporaryPlayers();
    } finally {
      loadingPlayers.value = false;
    }
  };
  const loadTemporaryPlayers = (): TemporaryPlayersMap => {
    try {
      const raw = localStorage.getItem(tempPlayersStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== 'object' || parsed === null) return {};

      const result: TemporaryPlayersMap = {};
      Object.entries(parsed as Record<string, unknown>).forEach(([playerId, value]) => {
        if (!playerId || typeof value !== 'object' || value === null) return;
        const candidate = value as Record<string, unknown>;
        const expiresAt = Number(candidate.expiresAt);
        const tournamentSlug = String(candidate.tournamentSlug ?? '').trim();
        if (!Number.isFinite(expiresAt) || expiresAt <= 0 || !tournamentSlug) return;
        result[playerId] = { expiresAt, tournamentSlug };
      });

      return result;
    } catch (err) {
      console.warn('[useIntegration] Failed to parse temporary players from localStorage:', err);
      return {};
    }
  };

  if (!globalTemporaryPlayers.has(tempPlayersStorageKey)) {
    globalTemporaryPlayers.set(tempPlayersStorageKey, ref<TemporaryPlayersMap>(loadTemporaryPlayers()));
  }
  const temporaryPlayers = globalTemporaryPlayers.get(tempPlayersStorageKey)!;

  const persistTemporaryPlayers = () => {
    localStorage.setItem(tempPlayersStorageKey, JSON.stringify(temporaryPlayers.value));
  };
  const oauthLoading = ref(false);
  const oauthSessionId = ref('');
  let oauthPollingTimer: ReturnType<typeof setInterval> | null = null;

  const stopPolling = () => {
    if (oauthPollingTimer) {
      clearInterval(oauthPollingTimer);
      oauthPollingTimer = null;
    }
  };

  const checkOAuthStatus = async () => {
    if (!oauthSessionId.value) return;

    try {
      const status = await sendNodeCGMessage<OAuthStatusResponse>(
        `${messagePrefix}:getOAuthSessionStatus`,
        { sessionId: oauthSessionId.value },
      );

      if (status.status === 'completed') {
        oauthLoading.value = false;
        stopPolling();
        oauthSessionId.value = '';
        tournamentsError.value = '';
        await loadRecentTournaments();
        return;
      }

      if (status.status === 'error' || status.status === 'expired') {
        oauthLoading.value = false;
        stopPolling();
        oauthSessionId.value = '';
        tournamentsError.value =
          status.error ?? `Could not complete OAuth login with ${providerLabel}.`;
      }
    } catch (error) {
      oauthLoading.value = false;
      stopPolling();
      oauthSessionId.value = '';
      tournamentsError.value =
        error instanceof Error ? error.message : 'Could not verify OAuth status.';
    }
  };

  const connectWithOAuth = async () => {
    oauthLoading.value = true;
    tournamentsError.value = '';
    stopPolling();

    try {
      const session = await sendNodeCGMessage<OAuthSessionResponse>(
        `${messagePrefix}:createOAuthSession`,
        {},
      );
      oauthSessionId.value = session.sessionId;
      window.open(session.authUrl, '_blank', 'noopener,noreferrer');

      oauthPollingTimer = setInterval(() => {
        void checkOAuthStatus();
      }, 1500);
    } catch (error) {
      oauthLoading.value = false;
      tournamentsError.value =
        error instanceof Error ? error.message : `Could not start OAuth with ${providerLabel}.`;
    }
  };

  const setManualToken = async (manualToken: string) => {
    try {
      await sendNodeCGMessage(`${messagePrefix}:setManualToken`, { token: manualToken });
    } catch (err) {
      
      console.warn(`[useIntegration] setManualToken failed for ${messagePrefix}:`, err);
    }
  };

  onMounted(() => {
    temporaryPlayers.value = loadTemporaryPlayers();
  });

  onBeforeUnmount(() => {
    stopPolling();
  });

  return reactive({
    hasTokenConfigured,
    hasValidatedToken,
    recentTournaments,
    loadingTournaments,
    tournamentsError,
    selectedTournamentSlug,
    tournamentInput,
    tournamentOptions,
    filteredTournamentOptions,
    selectedTournamentOption,
    canImportSelectedTournament,
    filterTournaments,
    loadRecentTournaments,
    players,
    selectedPlayerIds,
    importDialogOpen,
    importDialogError,
    loadingPlayers,
    importingTournament,
    openImportDialog,
    openSelectedTournamentImportDialog,
    importSelectedPlayers,
    autoImportAllPlayers,
    toggleAllPlayers,
    temporaryPlayers,
    oauthLoading,
    connectWithOAuth,
    setManualToken,
  });
}

export type IntegrationHandle = ReturnType<typeof useIntegration>;
