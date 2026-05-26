# DugoutOS — Softball Coach Assistant

AI-powered travel softball team operating system. Single-file browser app (no install needed) + optional Express/Supabase backend for teams that want persistent cloud storage.

## Live demo

```
https://jeremiah9980.github.io/softball-coach-assistant
```

No install. Open in browser, add your Anthropic API key, go.

---

## What's inside

| File | Purpose |
|---|---|
| `index.html` | **Full single-file app** — works standalone, no server needed |
| `softball_coach.html` | Alias of index.html (same content) |
| `server.js` | Optional Express backend — moves AI calls server-side, adds Supabase persistence |
| `public/` | Static assets served by Express |
| `references/schema.sql` | Paste into Supabase SQL Editor to create all tables |
| `.env.example` | Copy to `.env` and fill in your keys |
| `.github/workflows/deploy.yml` | GitHub Pages auto-deploy on push to master |

---

## Quick start — browser only (zero install)

1. Open `index.html` in any modern browser
2. Click **Set Key** — paste your Anthropic API key (`sk-ant-...`)
3. Click **Settings** — enter team name, age group, season
4. Done. All data saves to localStorage automatically.

Get an API key at [console.anthropic.com](https://console.anthropic.com).

---

## Quick start — with Express backend

```bash
# 1. Clone
git clone https://github.com/jeremiah9980/softball-coach-assistant.git
cd softball-coach-assistant

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

# 4. Set up database
# Paste references/schema.sql into your Supabase SQL Editor and run it

# 5. Start server
npm run dev        # development (nodemon, auto-restart)
npm start          # production

# App runs at http://localhost:3000
```

---

## API reference

All endpoints return JSON unless it is a streaming endpoint (which returns `text/event-stream`).

### Practice
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/practice/generate` | Stream AI practice plan (dual coach+player) |
| `GET` | `/api/practice/plans` | List saved plans |
| `POST` | `/api/practice/plans` | Save a plan |
| `DELETE` | `/api/practice/plans/:id` | Delete a plan |

### Tournaments
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/tournaments/generate` | Stream AI dual itinerary |
| `GET` | `/api/tournaments` | List tournaments |
| `POST` | `/api/tournaments` | Save a tournament |

### Season / Games
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/games` | List games |
| `POST` | `/api/games` | Add a game |
| `DELETE` | `/api/games/:id` | Delete a game |
| `POST` | `/api/games/:id/stats` | Save per-player batting stats |

### Roster
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/players` | List players with stats |
| `POST` | `/api/players` | Add a player |
| `PATCH` | `/api/players/:id` | Update a player |
| `DELETE` | `/api/players/:id` | Delete a player |

### Fundraising
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/fundraising/generate` | Stream AI dual fundraiser plan |
| `GET` | `/api/fundraising` | List campaigns |
| `POST` | `/api/fundraising` | Save a campaign |

### Library
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/library/research` | Stream AI drill/skill research |
| `GET` | `/api/library` | List saved entries |
| `POST` | `/api/library` | Save an entry |
| `DELETE` | `/api/library/:id` | Delete an entry |

### Coach AI
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Stream AI coaching conversation |

### Integrations
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/integrations/gamechanger/import` | Parse GC stats (CSV upload or paste) |
| `POST` | `/api/integrations/gamechanger/analyze` | Stream AI batting analysis |
| `POST` | `/api/integrations/band/draft` | Stream Band post draft |
| `POST` | `/api/integrations/compose` | Stream multi-platform message |
| `POST` | `/api/integrations/briefing` | Stream AI team briefing |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `SUPABASE_URL` | For backend | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | For backend | Service role key (never expose to client) |
| `SUPABASE_ANON_KEY` | Optional | Anon key for future client-side Supabase calls |
| `PORT` | No | Server port (default: 3000) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

---

## App features

### 9 tabs
- **Dashboard** — record, win %, streak, run diff, raised, roster count
- **Practice** — AI dual-version practice plans (coach + player prep with SVG diagrams)
- **Coach AI** — multi-thread coaching chat, persists across sessions
- **Season** — game log, win/loss chart, per-game batting stats entry
- **Tournaments** — schedule builder, AI dual itinerary, PDF + ICS calendar export
- **Fundraising** — AI dual plans (coordinator + family), progress tracking, PDF export
- **Roster** — player cards, season stats (AVG/OBP/SLG/OPS auto-calculated)
- **Library** — drill/skill research, save and search
- **Integrations** — GameChanger stats, Band posts, NCS tournament lookup (20 events)

### Export formats
- **PDF** — branded letter-size PDFs for practice plans, tournament itineraries, fundraiser plans
- **ICS** — calendar files for tournament games with arrive-by events and 45-minute alerts
- **JSON** — full data export/import for backup and device migration
- **Copy/Print** — every AI output supports clipboard copy and browser print

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single file, no build step) |
| AI | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| Charts | Chart.js 4.4.1 |
| Markdown | marked.js 12.0.0 |
| PDF | html2pdf.js 0.10.1 |
| Backend (optional) | Node.js + Express 4 |
| Database (optional) | Supabase (Postgres + RLS) |
| Deploy | GitHub Pages (static) or any Node host |

---

## Roadmap

- [ ] Supabase Auth (email + magic link)
- [ ] Multi-device sync via Supabase
- [ ] GameChanger CSV import endpoint
- [ ] Subscribable `.ics` calendar feed (`/api/calendar/:teamId.ics`)
- [ ] USSSA/NCS roster CSV export
- [ ] Player development dashboard (coach + parent views)
- [ ] Push notifications for schedule changes
- [ ] Multi-team org dashboard

---

## License

MIT
