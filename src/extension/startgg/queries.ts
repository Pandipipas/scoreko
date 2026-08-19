export const RECENT_TOURNAMENTS_QUERY = `
  query RecentTournaments($perPage: Int!) {
    currentUser {
      tournaments(query: { perPage: $perPage, filter: { tournamentView: "admin" } }) {
        nodes {
          id
          name
          slug
          startAt
          endAt
        }
      }
    }
  }
`;

export const TOURNAMENT_PARTICIPANTS_QUERY = `
  query TournamentParticipants($slug: String!, $page: Int!, $perPage: Int!) {
    tournament(slug: $slug) {
      participants(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          gamerTag
          prefix
          user {
            location {
              country
            }
            authorizations {
              type
              externalUsername
            }
            images {
              type
              url
            }
          }
        }
      }
    }
  }
`;

export const TOURNAMENT_EVENTS_QUERY = `
  query TournamentEvents($slug: String!) {
    tournament(slug: $slug) {
      events {
        id
        name
      }
    }
  }
`;

export const EVENT_PHASES_QUERY = `
  query EventPhases($eventId: ID!) {
    event(id: $eventId) {
      phases {
        id
        name
      }
    }
  }
`;

export const PHASE_GROUPS_QUERY = `
  query PhaseGroups($phaseId: ID!) {
    phase(id: $phaseId) {
      phaseGroups {
        nodes {
          id
          displayIdentifier
        }
      }
    }
  }
`;

export const GROUP_SETS_QUERY = `
  query GroupSets($phaseGroupId: ID!, $page: Int!) {
    phaseGroup(id: $phaseGroupId) {
      sets(page: $page, perPage: 50) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          winnerId
          fullRoundText
          round
          state
          slots {
            entrant {
              id
              participants {
                id
                gamerTag
                prefix
              }
            }
            standing {
              stats {
                score {
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_SET_FOR_REPORT_QUERY = `
  query GetSetForReport($setId: ID!) {
    set(id: $setId) {
      slots {
        entrant {
          id
          participants { id }
        }
      }
    }
  }
`;

export const REPORT_SET_MUTATION = `
  mutation ReportSet($setId: ID!, $winnerId: ID, $gameData: [BracketSetGameDataInput]) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {
      id
      state
    }
  }
`;
