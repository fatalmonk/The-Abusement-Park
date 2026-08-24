# The Abusement Park 🏆

Welcome to the official home of **The Abusement Park**, the premier Fantasy Premier League (FPL) mini-league where suffering meets glory.

## About
Founded in 2008, this league has hosted 18 seasons of high-stakes FPL management. This repository contains the source code for our historical dashboard, tracking winners, statistics, and season-by-season performance data.

## Features
- **Dynamic leaderboard** with All Time / Last 5 / Last 10 filters
- **Podium**, **timeline**, and cumulative titles chart (Chart.js)
- **Never won** and **longest drought** panels
- **Wall of Shame** fun awards
- **Season archive** with lightbox (← → arrow keys between seasons)
- **Photo avatars** (optional), FPL league link, JSON-LD for SEO

## Setup for Contributors

Edit the config block in `index.html` (search for `Config`):

| Field | Purpose |
|--------|---------|
| `LEAGUE_ID` | FPL mini-league ID — shows “View league on FPL” in header |
| `MANAGERS_EXTRA` | Members who have **never won** (not in `seasons` winners) |
| `seasons[]` | `{ year, winner, runnerUp?, img }` per season |
| `managers` (auto) | Built from winners + `MANAGERS_EXTRA`; set `avatarUrl` on extras or winners |

**Runner-up:** Add `runnerUp` on each season to enable the “Bottle” award.

**Avatars:** e.g. `{ name: 'Mac Alvi', avatarUrl: 'images/avatars/mac.png' }` in `MANAGERS_EXTRA` or extend winner entries.

**Screenshots:** Save PNGs in `/images/` matching each `img` path (e.g. `images/2026.png`).

## Cloudflare Pages

The live standings are served by the Pages Function at `/api/standings`. It
fetches league `113546` directly from FPL, validates the response, and caches
successful results at the edge for two minutes. The browser no longer depends
on a public CORS proxy.

Run the complete site locally with:

```sh
npx wrangler pages dev .
```

Then open the URL printed by Wrangler. After authenticating Wrangler, deploy
with:

```sh
npx wrangler pages deploy .
```

Failed FPL requests display an explicit unavailable state instead of presenting
hard-coded rows as live data.

## License
MIT License.

---
*Built for the managers of The Abusement Park.*
