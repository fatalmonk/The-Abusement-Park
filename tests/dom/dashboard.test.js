import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadHistoricalApp } from '../helpers/load-historical-app.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

function setupDom(fetchImpl = vi.fn()) {
  const dom = new JSDOM(html, { url: 'https://example.test/' });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  return { dom, app: loadHistoricalApp({ document: dom.window.document, fetch: fetchImpl }) };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('historical dashboard DOM behavior', () => {
  it('renders the podium, leaderboard, statistics, and archive cards', () => {
    const { app } = setupDom();
    app.updateView('all', document.querySelector('#tab-all'));
    app.buildHistory();

    expect(document.querySelectorAll('#podium .podium-card')).toHaveLength(3);
    expect(document.querySelectorAll('#standings .row')).toHaveLength(9);
    expect(document.querySelectorAll('#stats-bar .stat')).toHaveLength(6);
    expect(document.querySelectorAll('#history .history-card')).toHaveLength(18);
    expect(document.querySelector('#stats-bar').textContent).toContain('18');
  });

  it('keeps selected season-filter state synchronized with the panel', () => {
    const { app } = setupDom();
    app.updateView('last5', document.querySelector('#tab-last5'));

    expect(document.querySelector('#tab-last5').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('#tab-last5').classList.contains('active')).toBe(true);
    expect(document.querySelector('#tab-all').getAttribute('aria-selected')).toBe('false');
    expect(document.querySelector('#standings-panel').getAttribute('aria-labelledby')).toBe('tab-last5');
  });

  it('renders and exposes the existing missing-screenshot state', () => {
    const { app } = setupDom();
    app.updateView('all', document.querySelector('#tab-all'));
    app.buildHistory();
    const card = document.querySelector('.history-card');

    app.openLightboxAt(0);
    const image = document.querySelector('#lightbox-img');
    image.onerror();

    expect(card.getAttribute('role')).toBe('button');
    expect(document.querySelector('#lightbox-error').hidden).toBe(false);
    expect(document.querySelector('#lightbox-error').textContent)
      .toContain('Screenshot not available');
  });
});

describe('live standings DOM behavior', () => {
  it('renders profile links, metrics, and expand/collapse state', () => {
    const { app } = setupDom();
    const container = document.querySelector('#live-widget-content');
    const rows = Array.from({ length: 7 }, (_, index) => ({
      rank: index + 1,
      lastRank: index + 2,
      teamName: `Team ${index + 1}`,
      playerName: `Manager ${index + 1}`,
      entry: 100 + index,
      month: 10 + index,
      gameweek: 5 + index,
      season: 100 - index
    }));

    app.renderLiveStandings(container, rows);
    expect(container.querySelectorAll('.live-row')).toHaveLength(5);
    expect(container.querySelector('[data-live-toggle]').getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('a').href).toBe('https://fantasy.premierleague.com/entry/100/history');

    container.querySelector('[data-live-toggle]').click();
    expect(container.querySelectorAll('.live-row')).toHaveLength(7);
    expect(container.querySelector('[data-live-toggle]').getAttribute('aria-expanded')).toBe('true');
  });

  it('renders the characterized unavailable state after API failure', async () => {
    const { app } = setupDom(vi.fn().mockRejectedValue(new Error('offline')));
    await app.loadLiveStandings();
    expect(document.querySelector('#live-widget-content').textContent)
      .toContain('Live standings are temporarily unavailable');
  });
});
