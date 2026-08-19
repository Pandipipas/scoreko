import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useNotify } from '../composables/useNotify';
import { t } from '../i18n';
import { attachedBracketReplicant } from '../../../browser_shared/replicants';
import type { Schemas, BracketEvent, BracketPhase, BracketPhaseGroup, BracketSet } from '../../../types';
import { syncStateWithReplicant } from './store-sync';
import { debounce } from 'quasar';

type AttachedBracket = Schemas.AttachedBracket;

const normalizeAttachedBracket = (input: unknown): AttachedBracket => {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  return {
    provider: candidate.provider === 'startgg' || candidate.provider === 'challonge' ? candidate.provider : null,
    tournamentSlug: typeof candidate.tournamentSlug === 'string' ? candidate.tournamentSlug : null,
    startggEventId: typeof candidate.startggEventId === 'string' ? candidate.startggEventId : null,
    startggPhaseId: typeof candidate.startggPhaseId === 'string' ? candidate.startggPhaseId : null,
    startggGroupId: typeof candidate.startggGroupId === 'string' ? candidate.startggGroupId : null,
    activeMatchId: typeof candidate.activeMatchId === 'string' ? candidate.activeMatchId : null,
  };
};

export const useBracketStore = defineStore('bracket', () => {
  const { notifyError, notifySuccess } = useNotify();
  const provider = ref<'startgg' | 'challonge' | null>(null);
  
  const startggTournamentSlug = ref('');
  const startggEventId = ref('');
  const startggPhaseId = ref('');
  const startggGroupId = ref('');
  
  const challongeTournamentSlug = ref('');
  
  const events = ref<BracketEvent[]>([]);
  const phases = ref<BracketPhase[]>([]);
  const groups = ref<BracketPhaseGroup[]>([]);
  const matches = ref<BracketSet[]>([]);
  
  const activeMatchId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const attached = ref<AttachedBracket>({
    provider: null,
    tournamentSlug: null,
    startggEventId: null,
    startggPhaseId: null,
    startggGroupId: null,
    activeMatchId: null,
  });

  syncStateWithReplicant(attached, attachedBracketReplicant, normalizeAttachedBracket);

  const fetchStartggEvents = async (slug: string) => {
    loading.value = true;
    error.value = null;
    try {
      events.value = await nodecg.sendMessage('startgg:fetchEvents', { slug });
      startggTournamentSlug.value = slug;
      startggEventId.value = '';
      startggPhaseId.value = '';
      startggGroupId.value = '';
      phases.value = [];
      groups.value = [];
      matches.value = [];
      
      if (events.value.length === 1 && events.value[0]?.id) {
        await fetchStartggPhases(String(events.value[0].id));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error fetching events';
      error.value = msg;
      notifyError(msg);
    } finally {
      loading.value = false;
    }
  };

  const fetchStartggPhases = async (eventId: string) => {
    loading.value = true;
    error.value = null;
    try {
      phases.value = await nodecg.sendMessage('startgg:fetchPhases', { eventId });
      startggEventId.value = eventId;
      startggPhaseId.value = '';
      startggGroupId.value = '';
      groups.value = [];
      matches.value = [];

      if (phases.value.length === 1 && phases.value[0]?.id) {
        await fetchStartggGroups(String(phases.value[0].id));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error fetching phases';
      error.value = msg;
      notifyError(msg);
    } finally {
      loading.value = false;
    }
  };

  const fetchStartggGroups = async (phaseId: string) => {
    loading.value = true;
    error.value = null;
    try {
      groups.value = await nodecg.sendMessage('startgg:fetchGroups', { phaseId });
      startggPhaseId.value = phaseId;
      startggGroupId.value = '';
      matches.value = [];

      if (groups.value.length === 1 && groups.value[0]?.id) {
        await fetchStartggSets(String(groups.value[0].id));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error fetching groups';
      error.value = msg;
      notifyError(msg);
    } finally {
      loading.value = false;
    }
  };

  const fetchStartggSets = async (groupId: string) => {
    loading.value = true;
    error.value = null;
    try {
      matches.value = await nodecg.sendMessage('startgg:fetchSets', { phaseGroupId: groupId });
      startggGroupId.value = groupId;
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e instanceof Error ? e.message : 'Error fetching sets');
      error.value = msg;
      notifyError(msg);
    } finally {
      loading.value = false;
    }
  };

  const fetchChallongeMatches = async (slug: string) => {
    loading.value = true;
    error.value = null;
    try {
      matches.value = await nodecg.sendMessage('challonge:fetchMatches', { slug });
      challongeTournamentSlug.value = slug;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error fetching matches';
      error.value = msg;
      notifyError(msg);
    } finally {
      loading.value = false;
    }
  };

  const debouncedFetchStartggSets = debounce(fetchStartggSets, 500);
  const debouncedFetchChallongeMatches = debounce(fetchChallongeMatches, 500);

  const reportMatch = async (winnerId: string, scoresCsv?: string) => {
    if (!activeMatchId.value) return;
    loading.value = true;
    error.value = null;
    try {
      if (provider.value === 'startgg') {
        await nodecg.sendMessage('startgg:reportSet', {
          setId: activeMatchId.value,
          winnerId,
          scoresCsv,
        });
        
        
        const match = matches.value.find(m => m.id === activeMatchId.value);
        if (match) {
          match.state = 'completed';
          match.winnerId = winnerId;
          
          
        }
        
      } else if (provider.value === 'challonge') {
        await nodecg.sendMessage('challonge:reportMatch', {
          slug: challongeTournamentSlug.value,
          matchId: activeMatchId.value,
          winnerId,
          scoresCsv,
        });

        
        const match = matches.value.find(m => m.id === activeMatchId.value);
        if (match) {
          match.state = 'completed';
          match.winnerId = winnerId;
        }
      }
      notifySuccess(t('bracketReportSuccess'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('bracketReportFailed');
      error.value = msg;
      notifyError(msg);
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const attachTournament = () => {
    if (provider.value === 'startgg' && startggTournamentSlug.value) {
      attached.value = {
        provider: 'startgg',
        tournamentSlug: startggTournamentSlug.value,
        startggEventId: startggEventId.value || null,
        startggPhaseId: startggPhaseId.value || null,
        startggGroupId: startggGroupId.value || null,
        activeMatchId: activeMatchId.value,
      };
    } else if (provider.value === 'challonge' && challongeTournamentSlug.value) {
      attached.value = {
        provider: 'challonge',
        tournamentSlug: challongeTournamentSlug.value,
        startggEventId: null,
        startggPhaseId: null,
        startggGroupId: null,
        activeMatchId: activeMatchId.value,
      };
    }
    notifySuccess(t('bracketAttachSuccess'));
  };

  const detachTournament = () => {
    activeMatchId.value = null;
    matches.value = [];
    attached.value = {
      provider: null,
      tournamentSlug: null,
      startggEventId: null,
      startggPhaseId: null,
      startggGroupId: null,
      activeMatchId: null,
    };
    notifySuccess(t('bracketDetachSuccess'));
  };

  watch(activeMatchId, (newId) => {
    if (attached.value.activeMatchId !== newId) {
      attached.value = {
        ...attached.value,
        activeMatchId: newId,
      };
    }
  });

  watch(attached, (newAttached) => {
    if (newAttached.activeMatchId !== activeMatchId.value) {
      activeMatchId.value = newAttached.activeMatchId;
    }
    if (!newAttached.provider || !newAttached.tournamentSlug) return;
    
    if (!provider.value && !startggTournamentSlug.value && !challongeTournamentSlug.value) {
      provider.value = newAttached.provider;
      if (newAttached.provider === 'challonge') {
        fetchChallongeMatches(newAttached.tournamentSlug);
      } else if (newAttached.provider === 'startgg') {
        fetchStartggEvents(newAttached.tournamentSlug).then(() => {
          if (newAttached.startggEventId) {
            fetchStartggPhases(newAttached.startggEventId).then(() => {
              if (newAttached.startggPhaseId) {
                fetchStartggGroups(newAttached.startggPhaseId).then(() => {
                  if (newAttached.startggGroupId) {
                    debouncedFetchStartggSets(newAttached.startggGroupId);
                  }
                });
              }
            });
          }
        });
      }
    }
  }, { immediate: true });

  return {
    provider,
    startggTournamentSlug,
    startggEventId,
    startggPhaseId,
    startggGroupId,
    challongeTournamentSlug,
    events,
    phases,
    groups,
    matches,
    activeMatchId,
    loading,
    error,
    fetchStartggEvents,
    fetchStartggPhases,
    fetchStartggGroups,
    fetchStartggSets: debouncedFetchStartggSets,
    fetchChallongeMatches: debouncedFetchChallongeMatches,
    reportMatch,
    attached,
    attachTournament,
    detachTournament,
  };
});
