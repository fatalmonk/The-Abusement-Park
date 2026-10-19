import { CURRENT_LEAGUE_PLAYERS, FPL_PROFILE_BASE, MANAGERS_EXTRA, OLD_GUARDS, seasons } from './data.js';

export const currentPlayerByEntry = new Map(CURRENT_LEAGUE_PLAYERS.map(player => [player.entry, player]));

const AVATAR_COLORS = [
  ["#00e676","#0a0c10"], ["#ffd740","#0a0c10"], ["#ff6b6b","#fff"],
  ["#818cf8","#fff"],    ["#fb923c","#0a0c10"], ["#34d399","#0a0c10"],
  ["#e879f9","#fff"],    ["#60a5fa","#0a0c10"], ["#f87171","#fff"],
  ["#a78bfa","#fff"],    ["#64ffda","#0a0c10"], ["#fbbf24","#0a0c10"],
];

const colorMap = {};
let colorIdx = 0;
// Build managers roster from winners + extras
const managerByName = new Map();
seasons.forEach(s => {
  if (!managerByName.has(s.winner)) managerByName.set(s.winner, { name: s.winner, avatarUrl: '' });
});
MANAGERS_EXTRA.forEach(m => {
  const entry = typeof m === 'string' ? { name: m, avatarUrl: '' } : m;
  managerByName.set(entry.name, entry);
});
const managers = [...managerByName.values()];
const fplProfileByName = new Map();
CURRENT_LEAGUE_PLAYERS.forEach(player => {
  [player.name, ...(player.aliases || [])].forEach(name => {
    fplProfileByName.set(normalizeName(name), player);
  });
});

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function normalizeName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function fplProfileUrl(entry) {
  return `${FPL_PROFILE_BASE}/${entry}/history`;
}

export function profileForManager(name) {
  return fplProfileByName.get(normalizeName(name)) || null;
}

export function renderManagerName(name, className = 'manager-link') {
  const profile = profileForManager(name);
  const label = escapeHtml(name);
  if (!profile) return label;
  return `<a class="${className}" href="${fplProfileUrl(profile.entry)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

export function avatarColor(name) {
  if (!colorMap[name]) colorMap[name] = AVATAR_COLORS[colorIdx++ % AVATAR_COLORS.length];
  return colorMap[name];
}

export function getManager(name) {
  return managerByName.get(name) || { name, avatarUrl: '' };
}

export function renderAvatar(name, sizeClass) {
  const m = getManager(name);
  const [bg, fg] = avatarColor(name);
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  if (m.avatarUrl) {
    return `<div class="avatar ${sizeClass || ''}" style="background:${bg}" data-initials="${escapeHtml(initials)}" data-fg="${fg}">
      <img src="${escapeHtml(m.avatarUrl)}" alt="" loading="lazy" class="avatar-img">
    </div>`;
  }
  return `<div class="avatar ${sizeClass || ''}" style="background:${bg};color:${fg}">${escapeHtml(initials)}</div>`;
}

export function getFilteredSeasons(mode) {
  if (mode === 'last5') return seasons.slice(-5);
  if (mode === 'last10') return seasons.slice(-10);
  return seasons;
}

export function trailingStreak(data, name) {
  let streak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].winner === name) streak++;
    else break;
  }
  return streak;
}

export function longestEverStreak() {
  let best = { name: '', len: 0 };
  const names = [...new Set(seasons.map(s => s.winner))];
  names.forEach(name => {
    let cur = 0, max = 0;
    seasons.forEach(s => {
      if (s.winner === name) { cur++; max = Math.max(max, cur); }
      else cur = 0;
    });
    if (max > best.len) best = { name, len: max };
  });
  return best;
}

export function seasonsSinceLastWin(name) {
  for (let i = seasons.length - 1; i >= 0; i--) {
    if (seasons[i].winner === name) return seasons.length - 1 - i;
  }
  return seasons.length;
}
export function seasonsForManager(name, since) {
  if (!since) return seasons.length;
  const idx = seasons.findIndex(s => s.year === since);
  return idx >= 0 ? seasons.length - idx : seasons.length;
}

// Find manager with biggest gap between two consecutive wins
export function comebackKing() {
  const gaps = {};
  const names = [...new Set(seasons.map(s => s.winner))];
  names.forEach(name => {
    const wonAt = seasons.map((s, i) => s.winner === name ? i : -1).filter(i => i >= 0);
    if (wonAt.length < 2) return;
    let maxGap = 0;
    for (let i = 1; i < wonAt.length; i++) maxGap = Math.max(maxGap, wonAt[i] - wonAt[i - 1]);
    gaps[name] = maxGap;
  });
  const best = Object.entries(gaps).sort((a, b) => b[1] - a[1])[0];
  return best ? { name: best[0], gap: best[1] } : null;
}

export function buildStats(mode) {
  const data = getFilteredSeasons(mode);
  const tally = {};
  data.forEach(s => { tally[s.winner] = (tally[s.winner] || 0) + 1; });
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const total = data.length;
  const winnersAllTime = new Set(seasons.map(s => s.winner));
  const neverWon = managers.filter(m => !winnersAllTime.has(m.name));

  const droughts = managers
    .map(m => ({
      name: m.name,
      seasons: winnersAllTime.has(m.name) ? seasonsSinceLastWin(m.name) : seasons.length,
      neverWon: !winnersAllTime.has(m.name),
    }))
    .sort((a, b) => b.seasons - a.seasons)
    .slice(0, 6);

  const runnerUpTally = {};
  seasons.forEach(s => {
    if (s.runnerUp) runnerUpTally[s.runnerUp] = (runnerUpTally[s.runnerUp] || 0) + 1;
  });
  const hasRunnerUp = Object.keys(runnerUpTally).length > 0;
  const bottleWinner = hasRunnerUp
    ? Object.entries(runnerUpTally).sort((a, b) => b[1] - a[1])[0]
    : null;

  const allTimeTally = {};
  seasons.forEach(s => { allTimeTally[s.winner] = (allTimeTally[s.winner] || 0) + 1; });
  // Founding fathers — won in first 3 seasons (2008/09–2010/11)
  const early3 = new Set(seasons.slice(0, 3).map(s => s.winner));
  const foundingFathers = [...early3];

  // Back-to-back champions
  // One & done (won exactly once, drought ≥ 5 seasons)
  const oneAndDone = Object.entries(allTimeTally)
    .filter(([n, w]) => w === 1 && seasonsSinceLastWin(n) >= 5)
    .map(([n]) => n);

  const awardsShame = [];
  // Chief Bottler
  if (bottleWinner) {
    awardsShame.push({ emoji: '🍾', title: 'Chief Bottler', winner: bottleWinner[0], detail: `${bottleWinner[1]}× runner-up, couldn\'t finish the job` });
  }

  // Jawadur — special shame card
  if (managers.find(m => m.name === 'Jawadur Rahman')) {
    awardsShame.push({ emoji: '🕸️', title: '18 Years, 0 Crowns', winner: 'Jawadur Rahman', detail: 'Founding member. Witnessed every title. Won none.' });
  }

  // Wooden Spoon Club
  if (neverWon.length) {
    awardsShame.push({ emoji: '🥄', title: 'Wooden Spoon Club', winner: neverWon.map(m => m.name.split(' ')[0]).slice(0, 3).join(', '), detail: `${neverWon.length} manager${neverWon.length !== 1 ? 's' : ''} still titleless` });
  }

  // One & Done
  if (oneAndDone.length) {
    awardsShame.push({ emoji: '📉', title: 'One & Done', winner: oneAndDone.slice(0, 2).join(', '), detail: `Won once, haven't come close since` });
  }

  // Reigning drought holder
  const longestCurrentDrought = droughts.find(d => !d.neverWon);
  if (longestCurrentDrought && longestCurrentDrought.seasons > 3) {
    awardsShame.push({ emoji: '⏳', title: 'Longest Active Drought', winner: longestCurrentDrought.name, detail: `${longestCurrentDrought.seasons} seasons since last title` });
  }

  const latest = data[data.length - 1];
  const latestWinner = latest ? latest.winner.split(' ')[0] : '—';

  const runnerUpInView = {};
  data.forEach(s => {
    if (s.runnerUp) runnerUpInView[s.runnerUp] = (runnerUpInView[s.runnerUp] || 0) + 1;
  });
  const bottleEntry = Object.entries(runnerUpInView).sort((a, b) => b[1] - a[1])[0];
  const bottleLeader = bottleEntry
    ? { name: bottleEntry[0], count: bottleEntry[1] }
    : null;

  return {
    data, tally, sorted, total,
    uniqueChamps: Object.keys(tally).length,
    neverWon, awardsShame,
    latestWinner, bottleLeader,
  };
}