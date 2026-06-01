# The Abusement Park

A seasonal journey visual archive.

## Overview

This is a simple static site hosting seasonal archives for The Abusement Park project.

## Structure

```
├── index.html          # Main dashboard
├── CNAME               # Custom domain configuration
├── README.md           # This file
├── .gitignore          # Git ignore rules
├── LICENSE             # MIT License
├── favicon.ico         # Browser favicon
└── /images             # Season screenshots
    ├── 2008_09.png
    ├── ...
    └── 2025_26.png
```

## Deploying

1. Push to GitHub
2. Enable GitHub Pages in repo settings
3. Point domain DNS to GitHub Pages
4. Done

## Adding New Season

1. Add screenshot to `/images/` as `YYYY_YY.png`
2. Update `index.html` seasons array
3. Commit and push

## License

MIT License - See LICENSE file
