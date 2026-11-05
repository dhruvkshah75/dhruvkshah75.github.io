# Dhruv’s forest portfolio

A first person walk through a dark pixel forest. Scroll to move down the trail, move your mouse to look around, and open objects beside the path to read the portfolio. Built with Next.js, React, TypeScript, and Three.js.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000. `npm run build` creates a standalone static site in `out/`, ready for GitHub Pages or any static host. `npm start` serves that production export locally.

## The trail

1. **About Me:** profile, languages, databases, infrastructure, and frameworks.
2. **Projects:** five pinned GitHub projects with interactive hover reveals and development statuses.
3. **Experience:** research internship at GenQuery Technologies and education at BITS Pilani, Goa.
4. **Contact Me:** email and social links.

Scroll to walk through the forest and select a nearby object to open its full-page details. The numbered trail buttons, or keys **1–4**, jump to stops. **Enter** opens a nearby stop when the page has focus; **Escape** closes a detail view. On phones, swipe vertically to walk and tap a marker to open it. There is no navigation bar or index.

The visitor’s reduced motion preference pauses ambient movement and makes camera movement immediate. If WebGL is unavailable, scrolling still reveals each portfolio section through a fallback view. Fonts are self hosted; browsing requires no API token or third party requests.

## Update content

Edit `lib/portfolio.ts`:

- `profile`: name, title, summary, links and stack.
- `projects`: curated project copy, categories and status. Set `status: "In progress"` for ongoing work.
- `experience`: roles with `company`, `role`, optional `dates`, and `description`. Research experience appears before education.
- `stops`: labels and positions of the forest objects.

`npm run sync:github` refreshes public pins, repository languages, URLs and demo links while preserving curated project descriptions, categories and statuses. It uses public endpoints at editing time, so the live site works without GitHub API availability. Pins were initially verified on 6 November 2026. GameSync is identified as in progress from its current README.

The forest uses deterministic instanced block geometry, a low resolution canvas upscaled with nearest neighbour filtering, fog, a camera-following spotlight and point light, and projected HTML controls. The render loop pauses in background tabs; GPU resources and event listeners are released on teardown.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

The browser smoke check needs Google Chrome or Chromium and a running local preview:

```bash
npm run test:browser
```

Fonts: Geist, Geist Mono, and Pixelify Sans, distributed under the SIL Open Font License through their Fontsource packages. The forest and its props are built in code; there are no external art assets.
