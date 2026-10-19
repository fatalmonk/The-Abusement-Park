---
version: alpha
name: The Abusement Park
description: Editorial FPL history with scoreboard density, dark sporting accents, and restrained match-day color.
colors:
  primary: "#111827"
  secondary: "#475467"
  accent: "#00E676"
  teal: "#087F6A"
  purple: "#6647D7"
  danger: "#D92D20"
  gold: "#9A6700"
  silver: "#667085"
  bronze: "#A94F0B"
  background: "#F5F5F7"
  surface: "#F2F5F9"
  surface-light: "#F8FAFC"
  surface-hover: "#FFFFFF"
  border: "#CBD5E1"
  border-strong: "#B8C3D1"
typography:
  display-xl:
    fontFamily: Bebas Neue
    fontSize: 4rem
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.02em"
  display-md:
    fontFamily: Bebas Neue
    fontSize: 2rem
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.03em"
  body-md:
    fontFamily: DM Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-semibold:
    fontFamily: DM Sans
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.4
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  sm: 8px
  md: 12px
  lg: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    padding: 32px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 16px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-hover}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.surface-hover}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-filter:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.sm}"
    padding: 8px
  button-filter-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-hover}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.sm}"
    padding: 8px
  status-live:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.accent}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.sm}"
    padding: 8px
  danger-label:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.danger}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.sm}"
    padding: 8px
---

# The Abusement Park Design System

## Overview

The Abusement Park is an editorial archive and live scoreboard for a long-running Fantasy Premier League community. It balances historical gravitas with match-day energy: large condensed headlines, dense mono labels, clear rankings, and small flashes of vivid green. The interface should feel competitive and sharp, never like a generic sports dashboard.

## Colors

- **Primary:** Deep ink for core text, selected controls, score plates, and high-contrast surfaces.
- **Secondary:** Supporting copy and metadata. It must remain legible against light surfaces.
- **Accent:** Vivid match-day green. Reserve it for live status, focus, captain emphasis, and positive changes rather than large backgrounds.
- **Teal:** Accessible interactive emphasis and hover treatment on light backgrounds.
- **Purple:** A restrained atmospheric brand accent, mainly for decorative background light.
- **Danger:** Negative movement and Wall of Shame emphasis. Pair color with arrows or labels.
- **Gold, silver, and bronze:** Ranking semantics only. Never use medal colors as body text on light backgrounds.
- **Background and surfaces:** Cool neutral layers distinguish sections without heavy shadows.

## Typography

`Bebas Neue` is the display face for the title, rankings, and major numeric scores. Its condensed proportions create the competition-poster character.

`DM Sans` is the body face for manager names, descriptions, and readable content. `JetBrains Mono` is limited to compact metadata, controls, table labels, season markers, and live-score annotations.

Do not use mono text for paragraphs. Keep all-caps mono labels short and preserve their tracking. Numeric hierarchy should come from size and weight before color.

## Layout

The main reading column is centered and capped near 920px. Desktop page padding is 32px vertically and 20px horizontally; compact mobile layouts reduce spacing while retaining clear section boundaries.

Use the 4px spacing base consistently. Data-dense rows should prefer 8px and 16px increments. Reserve 24px and 32px gaps for section hierarchy rather than individual controls.

Live standings use progressive disclosure. Manager summaries stay compact; detailed player scores expand within their manager row. The pitch must fit without horizontal page scrolling from 320px upward.

## Elevation & Depth

Depth comes primarily from borders, surface contrast, and limited translucent background light. Use shadows sparingly for temporary elevation, player shirts, and modal separation. Avoid stacked card shadows or glass effects that compete with scores and names.

## Shapes

Use 8px for controls and compact score elements, 12px for panels, and 16px for major cards. Player-shirt silhouettes may use a custom small top radius. Do not apply pill shapes to every label; reserve pills for short metadata and statuses.

## Components

- **Primary buttons:** Deep ink with white text; hover may shift to accessible teal. Maintain a 40px minimum touch target on mobile.
- **Filter buttons:** Quiet light surface at rest and deep ink when selected. Preserve `aria-selected` and visible keyboard focus.
- **Live status:** Deep ink with vivid green text; include explicit copy or icons so state does not rely on color alone.
- **Standings rows:** Rank first, manager identity second, numeric scores aligned consistently. Do not change the existing response ordering in presentation code.
- **Player scores:** Show formation rows, player name, manager-specific points, captain or vice-captain label, and a visually quieter bench. Expansion controls must expose `aria-expanded` and `aria-controls`.
- **Error and empty states:** Use plain, actionable language inside the content region. Never leave a blank panel when live FPL data is unavailable.

## Do's and Don'ts

- Do prioritize scores, rankings, and manager names over decoration.
- Do preserve readable contrast and visible focus states.
- Do validate the interface at 320px, 768px, 1024px, and wide desktop widths.
- Do use icons, arrows, or text alongside status colors.
- Don't introduce unrelated gradients, purple action buttons, or oversized rounded cards.
- Don't expose raw third-party API objects directly to rendering code; normalize optional fields at the API boundary.
- Don't let one unavailable manager squad prevent the league standings from rendering.
- Don't compress touch targets below 40px merely to reduce visual height.
