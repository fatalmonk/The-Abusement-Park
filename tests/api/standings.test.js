import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapFixture,
  emptyStandingsFixture,
  jsonResponse,
  malformedManagerStandings,
  managerHistories,
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
  standingsResponse,
  bootstrapResponse
} = {}) {
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes('/leagues-classic/')) return standingsResponse ?? jsonResponse(clone(standings));
    if (url.includes('/bootstrap-static/')) return bootstrapResponse ?? jsonResponse(clone(bootstrap));
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
          careerAvgPct: '8.8%'
        },
        202: {
          month: 45,
          event: 2,
          gameweek: 45,
          season: 90,
          seasons: 1,
          careerBestPct: '25%',
          careerBestSeason: '2024/25',
          careerAvgPct: '25%'
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
