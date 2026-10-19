import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapFixture,
  emptyStandingsFixture,
  jsonResponse,
  liveFixture,
  malformedManagerStandings,
  managerHistories,
  managerPicks,
  standingsFixture
} from '../fixtures/fpl.js';

const originalCaches = globalThis.caches;

function clone(value) {
  return structuredClone(value);
}

function createContext(url = 'https://example.test/api/standings') {
  const pending = [];
  return {
    request: new Request(url),
    waitUntil(promise) { pending.push(promise); },
    pending
  };
}

function installCache(cachedResponse = null) {
  const cache = {
    match: vi.fn().mockResolvedValue(cachedResponse),
    put: vi.fn().mockResolvedValue(undefined)
  };
  globalThis.caches = { default: cache };
  return cache;
}

function installUpstream({
  standings = standingsFixture,
  bootstrap = bootstrapFixture,
  histories = managerHistories,
  picks = managerPicks,
  live = liveFixture,
  fixtures = [],
  standingsResponse,
  bootstrapResponse
} = {}) {
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes('/leagues-classic/')) return standingsResponse ?? jsonResponse(clone(standings));
    if (url.includes('/bootstrap-static/')) return bootstrapResponse ?? jsonResponse(clone(bootstrap));
    if (url.includes('/event/') && url.endsWith('/live/')) return jsonResponse(clone(live));
    if (url.includes('/fixtures/')) return jsonResponse(clone(fixtures));
    const picksMatch = url.match(/\/entry\/(.+?)\/event\/(.+?)\/picks/);
    if (picksMatch) return jsonResponse(clone(picks[picksMatch[1]] ?? { picks: [] }));
    const entry = url.match(/\/entry\/(.+?)\/history/)?.[1];
    const history = histories[entry];
    if (history instanceof Error) throw history;
    if (history instanceof Response) return history;
    return jsonResponse(clone(history ?? { current: [], past: [] }));
  });
}

async function loadModule() {
  vi.resetModules();
  return import('../../functions/api/standings.js');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-08-20T12:00:00Z'));
  installCache();
  installUpstream();
});

afterAll(() => {
  globalThis.caches = originalCaches;
  vi.useRealTimers();
});

describe('GET /api/standings contract', () => {
  it('returns stable standings, manager metrics, metadata, and MISS cache headers', async () => {
    const { onRequestGet } = await loadModule();
    const context = createContext();
    const response = await onRequestGet(context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=120');
    expect(response.headers.get('X-FPL-Cache')).toBe('MISS');
    expect(body.standings).toEqual(standingsFixture.standings);
    expect(body.new_entries).toEqual({ results: [] });
    expect(body.meta).toEqual({
      fetchedAt: '2025-08-20T12:00:00.000Z',
      leagueId: '113546',
      managerMetrics: {
        101: {
          month: 100,
          event: 2,
          gameweek: 50,
          season: 100,
          seasons: 2,
          careerBestPct: '5%',
          careerBestSeason: '2024/25',
          careerAvgPct: '8.8%',
          squad: [
            { id: 11, name: 'Raya', team: 'ARS', position: 1, slot: 1, points: 9, multiplier: 1, captain: false, viceCaptain: false },
            { id: 22, name: 'Saliba', team: 'ARS', position: 2, slot: 2, points: 6, multiplier: 1, captain: false, viceCaptain: true },
            { id: 33, name: 'Saka', team: 'ARS', position: 3, slot: 3, points: 8, multiplier: 2, captain: true, viceCaptain: false },
            { id: 44, name: 'Haaland', team: 'MCI', position: 4, slot: 12, points: 0, multiplier: 0, captain: false, viceCaptain: false }
          ]
        },
        202: {
          month: 45,
          event: 2,
          gameweek: 45,
          season: 90,
          seasons: 1,
          careerBestPct: '25%',
          careerBestSeason: '2024/25',
          careerAvgPct: '25%',
          squad: []
        }
      },
      nextDeadline: {
        event: 2,
        name: 'Gameweek 2',
        deadlineTime: '2025-08-22T17:30:00Z'
      }
    });
    expect(context.pending).toHaveLength(1);
    await Promise.all(context.pending);
    expect(caches.default.put).toHaveBeenCalledOnce();
  });

  it('returns cached responses as HIT without upstream requests', async () => {
    const cached = jsonResponse({ cached: true }, { headers: { 'Cache-Control': 'public, max-age=120' } });
    const cache = installCache(cached);
    globalThis.fetch = vi.fn();
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());

    expect(await response.json()).toEqual({ cached: true });
    expect(response.headers.get('X-FPL-Cache')).toBe('HIT');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('returns valid empty standings', async () => {
    installUpstream({ standings: emptyStandingsFixture });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.standings.results).toEqual([]);
    expect(body.meta.managerMetrics).toEqual({});
  });

  it('degrades missing bootstrap data to null deadline and zero month totals', async () => {
    installUpstream({ bootstrapResponse: jsonResponse({}, { status: 503 }) });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.meta.nextDeadline).toBeNull();
    expect(body.meta.managerMetrics['101'].month).toBe(0);
  });

  it('degrades partial manager-history failure to null metrics for that manager', async () => {
    installUpstream({ histories: { ...managerHistories, 202: new Error('network') } });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.meta.managerMetrics['101'].season).toBe(100);
    expect(body.meta.managerMetrics['202']).toEqual({
      month: null,
      event: null,
      gameweek: null,
      season: null,
      seasons: null,
      careerBestPct: null,
      careerBestSeason: null,
      careerAvgPct: null
    });
  });

  it('characterizes missing and invalid manager history fields', async () => {
    installUpstream({ histories: {
      101: { current: null, past: null },
      202: { current: [{ event: 2, points: 0 }], past: [{ season_name: '', rank_percentage: 'invalid' }] }
    } });
    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    expect(body.meta.managerMetrics['101']).toMatchObject({ month: null, gameweek: null, season: null, seasons: null });
    expect(body.meta.managerMetrics['202']).toMatchObject({ month: 0, gameweek: 0, season: null, seasons: 1, careerBestPct: null });
  });

  it('characterizes malformed manager records without changing the public response contract', async () => {
    installUpstream({ standings: malformedManagerStandings });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.standings.results[0].entry).toBeNull();
    expect(body.meta.managerMetrics.null).toBeDefined();
  });
});

describe('upstream failure contract', () => {
  it('returns 502/no-store when the standings request rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'FPL standings are temporarily unavailable.' });
  });

  it('returns 502/no-store for a non-2xx standings response', async () => {
    installUpstream({ standingsResponse: jsonResponse({}, { status: 429 }) });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'FPL standings are temporarily unavailable.' });
  });

  it('projects the first eligible bench player after a starter finishes without appearing', async () => {
    const elements = [
      { id: 1, web_name: 'Keeper', element_type: 1, team: 1 },
      { id: 2, web_name: 'Def One', element_type: 2, team: 1 },
      { id: 3, web_name: 'Def Two', element_type: 2, team: 1 },
      { id: 4, web_name: 'Def Three', element_type: 2, team: 1 },
      { id: 5, web_name: 'Def Missing', element_type: 2, team: 1 },
      { id: 6, web_name: 'Mid One', element_type: 3, team: 1 },
      { id: 7, web_name: 'Mid Two', element_type: 3, team: 1 },
      { id: 8, web_name: 'Mid Three', element_type: 3, team: 1 },
      { id: 9, web_name: 'Mid Four', element_type: 3, team: 1 },
      { id: 10, web_name: 'Forward One', element_type: 4, team: 1 },
      { id: 11, web_name: 'Forward Two', element_type: 4, team: 1 },
      { id: 12, web_name: 'Bench Keeper', element_type: 1, team: 1 },
      { id: 13, web_name: 'Bench Mid', element_type: 3, team: 1 },
      { id: 14, web_name: 'Bench Def', element_type: 2, team: 1 },
      { id: 15, web_name: 'Bench Forward', element_type: 4, team: 1 }
    ];
    const picks = elements.map((player, index) => ({
      element: player.id,
      position: index + 1,
      multiplier: index < 11 ? 1 : 0,
      is_captain: false,
      is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: { total_points: player.id === 13 ? 5 : 2, minutes: player.id === 5 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks }, 202: { picks: [] } },
      live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 5)).toMatchObject({ multiplier: 0, projectedOut: true, points: 0 });
    expect(squad.find(player => player.id === 13)).toMatchObject({ multiplier: 1, projectedIn: true, replaces: 5, points: 5 });
  });

  it('respects bench order while preserving a legal formation', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 4, 2, 3];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: 1
    }));
    const picks = elements.map((player, index) => ({
      element: player.id, position: index + 1, multiplier: index < 11 ? 1 : 0,
      is_captain: false, is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: { total_points: player.id === 13 ? 8 : player.id === 14 ? 6 : 2, minutes: player.id === 2 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks }, 202: { picks: [] } },
      live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 13)).not.toHaveProperty('projectedIn');
    expect(squad.find(player => player.id === 14)).toMatchObject({ projectedIn: true, replaces: 2 });
  });

  it('does not skip a higher-priority substitute whose fixture is still pending', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 3, 2, 4];
    const teams = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: teams[index]
    }));
    const picks = elements.map((player, index) => ({
      element: player.id, position: index + 1, multiplier: index < 11 ? 1 : 0,
      is_captain: false, is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: {
        total_points: player.id === 13 ? 0 : player.id === 14 ? 6 : 2,
        minutes: player.id === 5 || player.id === 13 ? 0 : 90
      }
    })) };
    installUpstream({
      bootstrap: {
        ...bootstrapFixture,
        elements,
        teams: [{ id: 1, short_name: 'ONE' }, { id: 2, short_name: 'TWO' }, { id: 3, short_name: 'THR' }]
      },
      picks: { 101: { picks }, 202: { picks: [] } },
      live,
      fixtures: [
        { team_h: 1, team_a: 3, finished: true },
        { team_h: 2, team_a: 4, finished: false }
      ]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 14)).not.toHaveProperty('projectedIn');
    expect(squad.some(player => player.projectedIn || player.projectedOut)).toBe(false);
  });

  it('promotes the vice-captain multiplier when the captain is confirmed absent', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 3, 2, 4];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: 1
    }));
    const picks = elements.map((player, index) => ({
      element: player.id,
      position: index + 1,
      multiplier: index === 4 ? 2 : index < 11 ? 1 : 0,
      is_captain: index === 4,
      is_vice_captain: index === 5
    }));
    const live = { elements: elements.map(player => ({
      id: player.id,
      stats: { total_points: player.id === 6 ? 7 : player.id === 13 ? 5 : 2, minutes: player.id === 5 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks, entry_history: { event_transfers_cost: 4 } }, 202: { picks: [] } },
      live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const metric = body.meta.managerMetrics[101];

    expect(metric.squad.find(player => player.id === 5)).toMatchObject({ multiplier: 0, projectedOut: true });
    expect(metric.squad.find(player => player.id === 6)).toMatchObject({ multiplier: 2, points: 14, viceCaptain: true });
    expect(metric.squad.find(player => player.id === 13)).toMatchObject({ multiplier: 1, points: 5, projectedIn: true });
    expect(metric.gameweek).toBe(metric.squad.reduce((sum, player) => sum + player.points, 0) - 4);
  });

  it('uses only the substitute goalkeeper for a missing goalkeeper', async () => {
    const positions = [1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 1, 4, 2, 3];
    const elements = positions.map((position, index) => ({
      id: index + 1, web_name: `Player ${index + 1}`, element_type: position, team: 1
    }));
    const picks = elements.map((player, index) => ({
      element: player.id, position: index + 1, multiplier: index < 11 ? 1 : 0,
      is_captain: false, is_vice_captain: false
    }));
    const live = { elements: elements.map(player => ({
      id: player.id, stats: { total_points: player.id === 12 ? 7 : 2, minutes: player.id === 1 ? 0 : 90 }
    })) };
    installUpstream({
      bootstrap: { ...bootstrapFixture, elements, teams: [{ id: 1, short_name: 'TST' }] },
      picks: { 101: { picks }, 202: { picks: [] } }, live,
      fixtures: [{ team_h: 1, team_a: 2, finished: true }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();
    const squad = body.meta.managerMetrics[101].squad;

    expect(squad.find(player => player.id === 12)).toMatchObject({ projectedIn: true, replaces: 1, points: 7 });
  });

  it('waits until every fixture in a double gameweek is finished', async () => {
    const bootstrap = {
      ...bootstrapFixture,
      elements: bootstrapFixture.elements.map(player => ({ ...player }))
    };
    installUpstream({
      bootstrap,
      live: { elements: liveFixture.elements.map(player => ({
        ...player,
        stats: { ...player.stats, minutes: player.id === 22 ? 0 : 90 }
      })) },
      fixtures: [
        { team_h: 1, team_a: 11, finished: true },
        { team_h: 2, team_a: 1, finished: false }
      ]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();

    expect(body.meta.managerMetrics[101].squad.some(player => player.projectedIn || player.projectedOut)).toBe(false);
  });

  it('does not project a sub before the missing starter fixture has finished', async () => {
    const bootstrap = {
      ...bootstrapFixture,
      elements: bootstrapFixture.elements.map(player => ({ ...player }))
    };
    installUpstream({
      bootstrap,
      live: { elements: liveFixture.elements.map(player => ({
        ...player,
        stats: { ...player.stats, minutes: player.id === 22 ? 0 : 90 }
      })) },
      fixtures: [{ team_h: 1, team_a: 11, finished: false }]
    });

    const { onRequestGet } = await loadModule();
    const body = await (await onRequestGet(createContext())).json();

    expect(body.meta.managerMetrics[101].squad.some(player => player.projectedIn || player.projectedOut)).toBe(false);
  });

  it('returns 502/no-store for invalid upstream JSON', async () => {
    installUpstream({ standingsResponse: new Response('{bad', { status: 200 }) });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'FPL returned an invalid response.' });
  });

  it.each([
    {},
    { standings: { results: [] } },
    { standings: { results: 'bad' }, new_entries: { results: [] } },
    { standings: { results: [] }, new_entries: { results: null } }
  ])('returns 502/no-store for invalid mandatory structure %#', async (payload) => {
    installUpstream({ standings: payload });
    const { onRequestGet } = await loadModule();
    const response = await onRequestGet(createContext());
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'FPL returned an unexpected response.' });
  });
});

describe('method contract', () => {
  it('rejects non-GET routing with 405 and Allow: GET', async () => {
    const { onRequest } = await loadModule();
    const response = onRequest();
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'Method not allowed.' });
  });
});
