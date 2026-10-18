export const standingsFixture = {
  league: { id: 113546, name: 'Fixture League' },
  standings: {
    results: [
      { id: 1, entry: 101, entry_name: 'Alpha FC', player_name: 'Alex Test', rank: 1, last_rank: 2, total: 100 },
      { id: 2, entry: 202, entry_name: 'Beta FC', player_name: 'Blair Test', rank: 2, last_rank: 1, total: 90 }
    ]
  },
  new_entries: { results: [] }
};

export const emptyStandingsFixture = {
  league: { id: 113546, name: 'Fixture League' },
  standings: { results: [] },
  new_entries: { results: [] }
};

export const managerHistories = {
  101: {
    current: [
      { event: 1, points: 50, total_points: 50 },
      { event: 2, points: 50, total_points: 100 }
    ],
    past: [
      { season_name: '2023/24', rank_percentage: '12.5' },
      { season_name: '2024/25', rank_percentage: '5.0' }
    ]
  },
  202: {
    current: [{ event: 2, points: 45, total_points: 90 }],
    past: [{ season_name: '2024/25', rank_percentage: '25.0' }]
  }
};

export const bootstrapFixture = {
  events: [
    { id: 1, name: 'Gameweek 1', deadline_time: '2025-08-15T17:30:00Z', finished: true },
    { id: 2, name: 'Gameweek 2', deadline_time: '2025-08-22T17:30:00Z', is_next: true }
  ]
};

export const malformedManagerStandings = {
  league: { id: 113546, name: 'Fixture League' },
  standings: { results: [{ entry: null, entry_name: null, player_name: null }] },
  new_entries: { results: [] }
};

export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers }
  });
}
