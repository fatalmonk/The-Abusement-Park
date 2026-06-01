# The Abusement Park 🏆

Welcome to the official home of **The Abusement Park**, the premier Fantasy Premier League (FPL) mini-league where suffering meets glory.

## About
Founded in 2008, this league has hosted 18 seasons of high-stakes FPL management. This repository contains the source code for our historical dashboard, tracking winners, statistics, and season-by-season performance data.

## Features
- **Dynamic Leaderboard:** Track all-time champions and recent form.
- **Season Archives:** Clickable history cards to view final league table screenshots.
- **Responsive Design:** Optimized for mobile and desktop viewing.

## Setup for Contributors
If you are an admin and need to update the league stats:

1. **Update data:** Edit the `seasons` array at the bottom of `index.html` (search for `const seasons`).
2. **Add screenshots:** Save the final table image in the `/images` folder. Filenames should match each season’s `img` path (e.g. `images/2026.png` for 2025/26).
3. **Required images:** Each season entry needs a PNG at its `img` path. Currently in the repo: `2016`, `2018`, `2020`, `2022`–`2026`, and `fpllogo.png`. Add any missing years so archive cards and the lightbox work.
4. **Deploy:** Push to `main` and GitHub Pages will update [theabusementpark.com](https://theabusementpark.com/).

## License
This project is licensed under the MIT License.

---
*Built for the managers of The Abusement Park.*
