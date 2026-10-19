const LEAGUE_ID = '113546';
const FPL_STANDINGS_URL = `https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`;
const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const FPL_ENTRY_BASE_URL = 'https://fantasy.premierleague.com/api/entry';
const FPL_EVENT_BASE_URL = 'https://fantasy.premierleague.com/api/event';
const FPL_FIXTURES_URL = 'https://fantasy.premierleague.com/api/fixtures/';
const CACHE_SECONDS = 120;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  Object.entries(JSON_HEADERS).forEach(([name, value]) => headers.set(name, value));
  return new Response(JSON.stringify(body), { ...init, headers });
}

async function fetchFplJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'The-Abusement-Park/1.0' },
  });
  if (!response.ok) throw new Error(`FPL request failed with ${response.status}`);
  return response.json();
}

function currentMonthEventIds(events) {
  const now = new Date();
  return new Set((events || [])
    .filter(event => {
      const deadline = new Date(event.deadline_time);
      return deadline.getUTCFullYear() === now.getUTCFullYear()
        && deadline.getUTCMonth() === now.getUTCMonth();
    })
    .map(event => event.id));
}

function nextDeadline(events) {
  const now = Date.now();
  const nextEvent = (events || []).find(event => event.is_next)
    || (events || [])
      .filter(event => Date.parse(event.deadline_time) > now)
      .sort((a, b) => Date.parse(a.deadline_time) - Date.parse(b.deadline_time))[0];

  if (!nextEvent?.deadline_time) return null;
  return {
    event: nextEvent.id,
    name: nextEvent.name || `Gameweek ${nextEvent.id}`,
    deadlineTime: nextEvent.deadline_time,
  };
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function careerProfile(past) {
  const seasons = Array.isArray(past) ? past : [];
  const rankedSeasons = seasons
    .map(row => ({
      season: row.season_name,
      percentage: Number.parseFloat(row.rank_percentage),
    }))
    .filter(row => Number.isFinite(row.percentage) && row.season);
  const best = rankedSeasons.reduce(
    (lowest, row) => !lowest || row.percentage < lowest.percentage ? row : lowest,
    null,
  );
  const percentages = rankedSeasons.map(row => row.percentage);

  return {
    seasons: seasons.length || null,
    careerBestPct: best ? formatPercentage(best.percentage) : null,
    careerBestSeason: best?.season ?? null,
    careerAvgPct: percentages.length
      ? formatPercentage(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
      : null,
  };
}

function finishedTeams(fixtures) {
  const statusByTeam = new Map();
  for (const fixture of fixtures || []) {
    for (const teamId of [fixture.team_h, fixture.team_a]) {
      const statuses = statusByTeam.get(teamId) || [];
      statuses.push(fixture.finished === true);
      statusByTeam.set(teamId, statuses);
    }
  }
  return new Set([...statusByTeam]
    .filter(([, statuses]) => statuses.length > 0 && statuses.every(Boolean))
    .map(([teamId]) => teamId));
}

function isLegalFormation(players) {
  const positions = players.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] || 0) + 1;
    return counts;
  }, {});
  return positions[1] === 1
    && (positions[2] || 0) >= 3
    && (positions[3] || 0) >= 2
    && (positions[4] || 0) >= 1;
}

function applyProjectedSubs(squad, finishedTeamIds) {
  if (!finishedTeamIds.size) return squad;
  const result = squad.map(player => ({ ...player }));
  const starters = result.filter(player => player.slot <= 11);
  const bench = result.filter(player => player.slot > 11).sort((a, b) => a.slot - b.slot);
  const unavailable = player => !player.appeared && finishedTeamIds.has(player.teamId);
  const activeStarters = new Map(starters.map(player => [player.id, player]));
  const usedBenchIds = new Set();

  for (const outgoing of starters.filter(unavailable)) {
    const candidates = outgoing.position === 1
      ? bench.filter(player => player.position === 1)
      : bench.filter(player => player.position !== 1);
    let incoming = null;
    for (const candidate of candidates) {
      if (usedBenchIds.has(candidate.id) || unavailable(candidate)) continue;
      const projectedStarters = [...activeStarters.values()]
        .filter(player => player.id !== outgoing.id)
        .concat(candidate);
      if (!isLegalFormation(projectedStarters)) continue;
      // Preserve bench priority while a higher eligible substitute is still to play.
      if (!candidate.appeared) break;
      incoming = candidate;
      break;
    }
    if (!incoming) continue;

    outgoing.multiplier = 0;
    outgoing.points = 0;
    outgoing.projectedOut = true;
    incoming.multiplier = 1;
    incoming.points = incoming.rawPoints;
    incoming.projectedIn = true;
    incoming.replaces = outgoing.id;
    activeStarters.delete(outgoing.id);
    activeStarters.set(incoming.id, incoming);
    usedBenchIds.add(incoming.id);
  }

  const captain = starters.find(player => player.captain);
  const viceCaptain = result.find(player => player.viceCaptain);
  if (captain && unavailable(captain) && viceCaptain?.appeared && activeStarters.has(viceCaptain.id)) {
    viceCaptain.multiplier = 2;
    viceCaptain.points = viceCaptain.rawPoints * 2;
  }

  return result;
}

function publicSquadPlayer(player) {
  const projected = {};
  if (player.projectedOut) projected.projectedOut = true;
  if (player.projectedIn) {
    projected.projectedIn = true;
    projected.replaces = player.replaces;
  }
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    position: player.position,
    slot: player.slot,
    points: player.points,
    multiplier: player.multiplier,
    captain: player.captain,
    viceCaptain: player.viceCaptain,
    ...projected,
  };
}

async function buildManagerMetrics(data, events, bootstrap = {}) {
  const entryIds = [...new Set([
    ...data.standings.results.map(team => team.entry),
    ...data.new_entries.results.map(team => team.entry),
  ])];

  const monthEventIds = currentMonthEventIds(events);
  const currentEvent = events.find(event => event.is_current)?.id
    ?? events.filter(event => event.finished).at(-1)?.id
    ?? null;
  const playersById = new Map((bootstrap.elements || []).map(player => [player.id, player]));
  const teamsById = new Map((bootstrap.teams || []).map(team => [team.id, team.short_name]));
  let liveStats = new Map();
  let finishedTeamIds = new Set();

  if (currentEvent) {
    try {
      const live = await fetchFplJson(`${FPL_EVENT_BASE_URL}/${currentEvent}/live/`);
      liveStats = new Map((live.elements || []).map(player => [player.id, {
        points: player.stats?.total_points ?? 0,
        appeared: (player.stats?.minutes ?? 0) > 0
          || (player.stats?.yellow_cards ?? 0) > 0
          || (player.stats?.red_cards ?? 0) > 0,
      }]));
    } catch {
      // Manager history remains available when live event data is unavailable.
    }

    try {
      const fixtures = await fetchFplJson(`${FPL_FIXTURES_URL}?event=${currentEvent}`);
      finishedTeamIds = finishedTeams(fixtures);
    } catch {
      // Live points remain available when fixture status is unavailable.
    }
  }

  const metrics = await Promise.all(entryIds.map(async entry => {
    try {
      const history = await fetchFplJson(`${FPL_ENTRY_BASE_URL}/${entry}/history/`);
      const current = Array.isArray(history.current) ? history.current : [];
      const latest = current.at(-1);
      let squad = [];
      let projectedGameweek = null;
      if (currentEvent) {
        try {
          const picks = await fetchFplJson(`${FPL_ENTRY_BASE_URL}/${entry}/event/${currentEvent}/picks/`);
          squad = applyProjectedSubs((picks.picks || []).map(pick => {
            const player = playersById.get(pick.element) || {};
            const multiplier = pick.multiplier ?? 0;
            const stats = liveStats.get(pick.element) || { points: 0, appeared: false };
            return {
              id: pick.element,
              name: player.web_name || `Player ${pick.element}`,
              team: teamsById.get(player.team) || '',
              teamId: player.team ?? null,
              position: player.element_type || null,
              slot: pick.position,
              points: stats.points * multiplier,
              rawPoints: stats.points,
              appeared: stats.appeared,
              multiplier,
              captain: Boolean(pick.is_captain),
              viceCaptain: Boolean(pick.is_vice_captain),
            };
          }), finishedTeamIds).map(publicSquadPlayer);
          if (squad.some(player => player.projectedIn || player.projectedOut)) {
            projectedGameweek = squad.reduce((sum, player) => sum + player.points, 0)
              - (picks.entry_history?.event_transfers_cost ?? 0);
          }
        } catch {
          // A single private or unavailable team should not block league standings.
        }
      }
      const month = current.length
        ? current.filter(row => monthEventIds.has(row.event)).reduce((sum, row) => sum + row.points, 0)
        : null;
      return [String(entry), {
        month,
        gameweek: projectedGameweek ?? latest?.points ?? null,
        season: latest?.total_points ?? null,
        event: latest?.event ?? null,
        squad,
        ...careerProfile(history.past),
      }];
    } catch {
      return [String(entry), {
        month: null,
        gameweek: null,
        season: null,
        event: null,
        seasons: null,
        careerBestPct: null,
        careerBestSeason: null,
        careerAvgPct: null,
      }];
    }
  }));

  return Object.fromEntries(metrics);
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/standings', context.request.url), { method: 'GET' });
  const cached = await cache.match(cacheKey);

  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set('X-FPL-Cache', 'HIT');
    return response;
  }

  let upstream;
  try {
    upstream = await fetch(FPL_STANDINGS_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'The-Abusement-Park/1.0' },
    });
  } catch {
    return json({ error: 'FPL standings are temporarily unavailable.' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!upstream.ok) {
    return json({ error: 'FPL standings are temporarily unavailable.' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'FPL returned an invalid response.' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!Array.isArray(data?.standings?.results) || !Array.isArray(data?.new_entries?.results)) {
    return json({ error: 'FPL returned an unexpected response.' }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let events = [];
  let bootstrap = {};
  try {
    bootstrap = await fetchFplJson(FPL_BOOTSTRAP_URL);
    events = Array.isArray(bootstrap.events) ? bootstrap.events : [];
  } catch {
    // Standings remain available even if FPL's event schedule is temporarily unavailable.
  }

  const managerMetrics = await buildManagerMetrics(data, events, bootstrap);

  const response = json({
    ...data,
    meta: {
      fetchedAt: new Date().toISOString(),
      leagueId: LEAGUE_ID,
      managerMetrics,
      nextDeadline: nextDeadline(events),
    },
  }, {
    headers: {
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      'X-FPL-Cache': 'MISS',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export function onRequest() {
  return json({ error: 'Method not allowed.' }, {
    status: 405,
    headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
  });
}
