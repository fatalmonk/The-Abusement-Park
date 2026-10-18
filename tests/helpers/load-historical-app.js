import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const inlineScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((source) => source.includes('const seasons ='));

if (!inlineScript) throw new Error('Application script not found');

const cut = inlineScript.indexOf('function init()');
const source = inlineScript.slice(0, cut).replace(
  /document\.addEventListener\('error',[\s\S]*?\n    \}\);/,
  ''
);
const exportsSource = `${source}\n;globalThis.__app = { seasons, MANAGERS_EXTRA, getFilteredSeasons, trailingStreak, longestEverStreak, seasonsSinceLastWin, seasonsForManager, comebackKing, buildStats, normalizeName, updateView, buildHistory, renderLiveStandings, loadLiveStandings, openLightboxAt, closeLightbox };`;

export function loadHistoricalApp({ document = globalThis.document, fetch = globalThis.fetch } = {}) {
  const documentStub = document ?? {
    addEventListener() {},
    removeEventListener() {}
  };
  const sandbox = {
    document: documentStub,
    fetch,
    URL,
    Date,
    console,
    navigator: globalThis.navigator,
    setTimeout,
    clearTimeout,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(exportsSource, sandbox, { filename: 'index.html:application-script' });
  return sandbox.__app;
}

export function extractHistoricalDataset() {
  return loadHistoricalApp({ document: undefined, fetch: undefined }).seasons;
}
