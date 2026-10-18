import { LEAGUE_ID } from './data.js';
import { currentPlayerByEntry, escapeHtml, fplProfileUrl } from './domain.js';

// --- FEATURE: Live FPL Standings ---
export function liveScore(value) {
  return value === null || value === undefined ? '—' : escapeHtml(value);
}

export function renderNextDeadline(nextDeadline) {
  const deadlineEl = document.getElementById('live-deadline');
  const deadline = nextDeadline?.deadlineTime ? new Date(nextDeadline.deadlineTime) : null;
  if (!deadline || Number.isNaN(deadline.getTime())) {
    deadlineEl.hidden = true;
    deadlineEl.textContent = '';
    return;
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(undefined, {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(deadline).map(part => [part.type, part.value])
  );
  const eventName = nextDeadline.name || `Gameweek ${nextDeadline.event}`;
  deadlineEl.textContent = `${eventName} • Deadline: ${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`;
  deadlineEl.hidden = false;
}

export function renderLiveRow(team) {
  // Lower rank number = better position.
  let trend = '<span class="live-trend trend-flat">−</span>';
  if (team.lastRank !== 0 && team.rank < team.lastRank) trend = '<span class="live-trend trend-up">▲</span>';
  else if (team.lastRank !== 0 && team.rank > team.lastRank) trend = '<span class="live-trend trend-down">▼</span>';

  return `
    <div class="live-row">
      <div class="live-rank">${team.rank}${trend}</div>
      <div>
        <div class="live-manager-line">
          <div class="live-manager"><a class="live-profile-link" href="${fplProfileUrl(team.entry)}" target="_blank" rel="noopener noreferrer">${escapeHtml(team.playerName)}</a></div>
          <span class="live-team">${escapeHtml(team.teamName)}</span>
        </div>
        <div class="live-team-line">
          ${team.seasons ? `<span class="live-meta" aria-label="${team.seasons} seasons">S ${team.seasons}</span>` : ''}
          ${team.careerBestPct ? `<span class="live-meta" title="Career Best Finish · ${escapeHtml(team.careerBestSeason)}" aria-label="Career Best Finish ${escapeHtml(team.careerBestPct)}, ${escapeHtml(team.careerBestSeason)}">CBF ${escapeHtml(team.careerBestPct)}</span>` : ''}
          ${team.careerAvgPct ? `<span class="live-meta live-meta-caf" title="Career Average Finish" aria-label="Career Average Finish ${escapeHtml(team.careerAvgPct)}">CAF ${escapeHtml(team.careerAvgPct)}</span>` : ''}
        </div>
      </div>
      <div class="live-scores" aria-label="Month ${liveScore(team.month)}, gameweek ${liveScore(team.gameweek)}, season ${liveScore(team.season)}">
        <span class="live-score">${liveScore(team.month)}</span>
        <span class="live-score">${liveScore(team.gameweek)}</span>
        <span class="live-score">${liveScore(team.season)}</span>
      </div>
    </div>
  `;
}

export function renderLiveRows(rows, expanded = false) {
  const visibleRows = expanded ? rows : rows.slice(0, 5);
  const hiddenCount = Math.max(rows.length - 5, 0);
  const currentMonth = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date());
  return `
    <div class="live-table">
      <div class="live-table-head" aria-hidden="true">
        <span></span><span></span>
        <div class="live-score-head"><span>${currentMonth}</span><span>GW</span><span>Season</span></div>
      </div>
      ${visibleRows.map(renderLiveRow).join('')}
      ${hiddenCount ? `<button type="button" class="live-toggle" aria-expanded="${expanded}" data-live-toggle>${expanded ? 'Show top 5' : `Show ${hiddenCount} more`}</button>` : ''}
    </div>
  `;
}

export function renderLiveStandings(container, rows, expanded = false) {
  container.innerHTML = renderLiveRows(rows, expanded);
  const toggle = container.querySelector('[data-live-toggle]');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    renderLiveStandings(container, rows, !expanded);
  });
}

export async function loadLiveStandings() {
  const container = document.getElementById('live-widget-content');
  if (!LEAGUE_ID) {
    container.innerHTML = '<div class="empty-note">Set LEAGUE_ID at the top of the script to see live standings.</div>';
    return;
  }

  try {
    const response = await fetch('./api/standings', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    renderNextDeadline(data.meta?.nextDeadline);
    const managerMetrics = data.meta?.managerMetrics || {};
    const standingsRows = data.standings.results.map(team => {
      const career = currentPlayerByEntry.get(team.entry);
      const metrics = managerMetrics[String(team.entry)] || {};
      return {
        entry: team.entry,
        playerName: team.player_name,
        teamName: team.entry_name,
        careerBestPct: career?.careerBestPct ?? metrics.careerBestPct,
        careerBestSeason: career?.careerBestSeason ?? metrics.careerBestSeason,
        careerAvgPct: career?.careerAvgPct ?? metrics.careerAvgPct,
        seasons: career?.seasons ?? metrics.seasons,
        rank: team.rank,
        lastRank: team.last_rank,
        month: metrics.month,
        gameweek: metrics.gameweek,
        season: metrics.season ?? team.total,
      };
    });
    const newEntryRows = data.new_entries.results.map((team, index) => {
      const career = currentPlayerByEntry.get(team.entry);
      const metrics = managerMetrics[String(team.entry)] || {};
      return {
        entry: team.entry,
        playerName: `${team.player_first_name} ${team.player_last_name}`,
        teamName: team.entry_name,
        careerBestPct: career?.careerBestPct ?? metrics.careerBestPct,
        careerBestSeason: career?.careerBestSeason ?? metrics.careerBestSeason,
        careerAvgPct: career?.careerAvgPct ?? metrics.careerAvgPct,
        seasons: career?.seasons ?? metrics.seasons,
        rank: index + 1,
        lastRank: 0,
        month: metrics.month,
        gameweek: metrics.gameweek,
        season: metrics.season ?? 'New',
      };
    });
    const rows = standingsRows.length ? standingsRows : newEntryRows;
    renderLiveStandings(container, rows);
    if (data.meta?.fetchedAt) {
      const updated = new Date(data.meta.fetchedAt);
      const status = document.createElement('div');
      status.className = 'empty-note';
      status.textContent = `Last updated ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      container.appendChild(status);
    }
  } catch (error) {
    console.error("Error fetching live FPL data:", error);
    renderNextDeadline(null);
    container.innerHTML = '<div class="empty-note">Live standings are temporarily unavailable. Please try again shortly.</div>';
  }
}