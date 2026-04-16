# Memory Game (Concentration) — Google Trends Edition

## Project Purpose

A browser-based memory match (concentration) card game where the pictures on the cards are sourced from **Google Trends and Wikipedia trending topics**. Players flip cards to find matching pairs; each pair reveals a trending topic and its associated images. Trends are fetched fresh daily, so the game always reflects what's happening in the world right now.

The game features:
- Progressive difficulty across levels (more cards, fewer allowed mistakes)
- A lives system (3 lives) with a scoring mechanic based on matched trends and view counts
- **Normal mode** (any matching images) and **Challenge mode** (each pair shows different images of the same trend)
- Light/dark theme toggle
- Date picker to play with trends from previous days
- Fully responsive layout for desktop and mobile

---

## Repository Layout

```
memorygame/          ← frontend (this repo)
  index.html
  js/
  css/
  images/
  words/offline.json ← offline fallback trend data
  assets/

memorygame-backend/  ← separate repo, data pipeline
  build.js
  google-trend-query.js
  wikipedia-trend-query.js
  image-indexer.js
  combine.js
  data/              ← generated JSON indexes
```

---

## Frontend Architecture

### Entry Point

**[js/main.js](js/main.js)** — Bootstraps the app. Fetches today's trend data from the backend (with a fallback chain: today → yesterday → offline.json), restores any saved game from localStorage, and wires up the `Menu` and `Game` instances.

### Core Game Modules

| File | Responsibility |
|---|---|
| [js/Game.js](js/Game.js) | Central game controller. Manages the game loop, level progression, lives, score, cell activation/matching, board teardown/setup with transitions, and face-expression feedback. |
| [js/TrendSelector.js](js/TrendSelector.js) | Manages pools of available trends (unused, deferred, used, unusable). Validates image URLs before use (HEAD + Image.onload), caches results in localStorage. Computes scores from trend view counts. |
| [js/board.js](js/board.js) | Defines `Board` (cell count + allowed mistakes) and `BoardCreator` (generates progressively harder boards by level, adapting to phone vs desktop). |
| [js/cell.js](js/cell.js) | Individual card logic. Manages cell states (DEFAULT, REVEALED, SOLVED, INACTIVE), renders trend images and labels, drives the 3D card-flip animation, and handles image-slide for challenge mode. |
| [js/handleClick.js](js/handleClick.js) | Processes card clicks, evaluates matches, tracks mistakes, updates score, and triggers win/loss transitions. |
| [js/CellSolvedLoop.js](js/CellSolvedLoop.js) | Drives the post-match animation sequence on a solved pair: image slide, text type-in for the trend name, background color reveal, and optional bespoke color animation for high-view-count trends. |

### UI Modules

| File | Responsibility |
|---|---|
| [js/Menu.js](js/Menu.js) | Menu screen with date picker (navigate past trend days), Normal/Challenge mode toggle, light/dark theme toggle, and Continue/Restart buttons. |
| [js/graphics.js](js/graphics.js) | Visual helpers: face emotion system, percent-score animator, cell background color sequencer, tooltips, text-splash effects, type-text animation, and message display. |
| [js/gridlayout.js](js/gridlayout.js) | Calculates optimal grid dimensions for the current cell count and viewport. Manages CSS perspective and scale for 3D card effects. Reacts to window resize. |

### Configuration

**[js/config.js](js/config.js)** — Single source of truth for:
- Backend base URL and endpoint names (`today`, `fallback`, `index`)
- Timing constants (animation durations, delays)
- RGBA color palettes for light and dark themes
- Game messages (victory, failure, near-miss, etc.)
- Animation keyframe definitions (shake, slide, splash)
- Difficulty thresholds and max lives

### CSS

| File | Covers |
|---|---|
| [css/style.css](css/style.css) | CSS custom properties for theming, global layout, typography, fade animations |
| [css/cell.css](css/cell.css) | 3D card-flip mechanics (`transform-style: preserve-3d`), front/back faces, image container, hover shadows |
| [css/game.css](css/game.css) | HUD (level counter, score display, face container), grid layout |
| [css/menu.css](css/menu.css) | Menu card-flip exit animation, Google-color scheme, toggle/button states, date navigation |

---

## Backend Architecture (`memorygame-backend/`)

The backend is a **Node.js data pipeline** that runs on a cron schedule and produces static JSON files served to the frontend.

### Pipeline

```
Cron (noon daily)
  → google-trend-query.js   scrape Google Trends (Puppeteer + stealth)
  → wikipedia-trend-query.js fetch Wikipedia trending articles (Wikimedia API)
  → image-indexer.js        fetch 3 images per trend (Yandex / Wikipedia thumbnails)
  → combine.js              merge Google + Wikipedia indexes
  → build.js                write timestamped JSON + update index.json manifest
```

### Key Backend Files

| File | Responsibility |
|---|---|
| `build.js` | Orchestrates the pipeline; checks file freshness (120-min max age); writes `data/index.json` manifest mapping dates to filenames. |
| `google-trend-query.js` | Puppeteer scrapes Google Trends across 19 categories. Applies ~53 regex filters (sports, finance, short codes, profanity). Marks trends with >100k views as "special". |
| `wikipedia-trend-query.js` | Hits the Wikimedia trending API; filters via profanity detection. |
| `image-indexer.js` | Coordinates image fetching per trend, validates URLs, produces the final index. |
| `yandexImages.js` | Scrapes Yandex Image Search for 3 images per trend; filters bad/blocked domains. |
| `wikipediaImages.js` | Extracts Wikipedia article thumbnail URLs. |
| `combine.js` | Merges Google and Wikipedia indexes (Google takes priority; Wikipedia fills in unique entries). |
| `puppeteerSession.js` | Manages Puppeteer browser instances with rotating proxy IPs to avoid bot detection. |

### Trend Data Shape (served to frontend)

```json
{
  "fetchedDate": "2026/04/15",
  "count": 450,
  "trends": {
    "bitcoin": {
      "url": ["https://...", "https://..."],
      "views": "1.2M",
      "special": false,
      "rank": 1
    }
  }
}
```

---

## Data Flow: Frontend ↔ Backend

1. `main.js` fetches `/index` → receives `{ "2026/04/15": "image-index-2026-04-15T16-13-29.json", ... }`
2. Menu lets the user pick a date; `main.js` fetches the corresponding JSON file
3. `TrendSelector` consumes the trend list; validates image URLs on demand; feeds valid trends to `Game`
4. If the backend is unreachable, the game falls back to `words/offline.json`

---

## State Persistence (localStorage)

| Key | Contents |
|---|---|
| `gameState` | Current level, score, lives, active trends |
| `trendSelectorState` | Used/deferred/unusable trend pools |
| `imageValidationCache` | Per-URL validation results (avoids re-fetching) |
| `preferences` | Theme, game mode, selected date |
