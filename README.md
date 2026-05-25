# J! Play

A Jeopardy! simulator that pulls real historical games from [J! Archive](https://j-archive.com) and lets you play them interactively. Tracks Coryat scores, category strengths, and a global leaderboard.

> **Note:** J! Archive is a fan-run site. This project is non-commercial and for personal use. All clue content is © Jeopardy Productions, Inc.

## Stack

- **Frontend:** React (Vite) + React Router + Tailwind + Supabase JS — deployed to Vercel
- **Backend:** Node + Express scraper (cheerio + axios), in-memory cache, polite rate limit — deployed to Railway
- **DB / Auth:** Supabase (Postgres + Auth)

## Repo layout

```
jplay/
├── client/                 # React frontend
├── server/                 # Express scraper + API
├── supabase/migrations/    # SQL to run in your Supabase project
└── README.md
```

## Local development

### 1. Supabase

1. Create a project at https://supabase.com.
2. In the SQL Editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Grab:
   - **Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key (server-side only) → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Server

```bash
cd server
cp .env.example .env   # then fill in keys
npm install
npm run dev            # http://localhost:3001
```

### 3. Client

```bash
cd client
cp .env.example .env   # then fill in keys
npm install
npm run dev            # http://localhost:5173
```

Open http://localhost:5173 and click **Play Now**.

## Environment variables

### Server (`/server/.env`)

| Var | Notes |
| --- | --- |
| `PORT` | Default `3001` |
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, never expose |
| `ALLOWED_ORIGIN` | Comma-separated list. In dev: `http://localhost:5173`. In prod: your Vercel URL. |

### Client (`/client/.env`)

| Var | Notes |
| --- | --- |
| `VITE_API_URL` | URL of the deployed Express server |
| `VITE_SUPABASE_URL` | Your project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |

## Deployment

### Frontend → Vercel

1. Import the repo into Vercel, set the **root directory** to `client/`.
2. Build command: `npm run build`, output: `dist`.
3. Set `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in Vercel project settings.
4. [`client/vercel.json`](client/vercel.json) enables SPA fallback.

### Backend → Railway

1. Create a new Railway service from this repo, root directory `server/`.
2. Set env vars listed above (`ALLOWED_ORIGIN` = your Vercel URL).
3. Railway auto-detects `Procfile` + `railway.json`. Healthcheck hits `/api/health`.

## How play works

- **Board mode** – classic 6×5 grid, pick clues one at a time.
- **Random clue mode** – J + DJ clues shuffled and served in random order.
- **Voice mode** – clues read aloud via the Web Speech API. Spacebar to buzz in, then speak your answer.

Scoring:
- Regular clue correct/wrong: +/- clue value.
- Daily Double: +/- wager.
- Coryat: clue value on correct, 0 otherwise. DDs and Final Jeopardy are excluded.

## Scraping notes

J! Archive's HTML varies across eras. The scraper is defensive:

- Polite 1-second min gap between outbound requests.
- 24h in-memory cache per `game_id`.
- 30 req/min rate limit per IP on `/api/game/*`.
- Unrevealed clues and HTML formatting in answers are stripped/skipped gracefully.

If a specific older game ID parses oddly, the selectors in [`server/src/scraper/jArchive.js`](server/src/scraper/jArchive.js) are the place to tweak.

## License / attribution

Code is MIT. Jeopardy! and its content are trademarks of Jeopardy Productions, Inc. This project is fan-made and does not host any content — it scrapes J! Archive on demand.
