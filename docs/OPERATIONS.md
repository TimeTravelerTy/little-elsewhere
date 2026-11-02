# Operations

Running, connecting models, spending limits, the API, validation and deployment. For how the simulation's systems fit together and how to tune them, see [WORLD-II.md](WORLD-II.md).

## Running locally

Requires Node.js 22.13 or newer (Node 24 LTS recommended).

```sh
npm install
cp .env.example .env
npm run build
npm start
```

On macOS, you can also double-click **Launch Little Elsewhere.command** to start it.

Open **http://127.0.0.1:3000**. Without an OpenRouter key, the town runs on deterministic, personality-weighted routines. To enable model decisions, set `OPENROUTER_API_KEY` in `.env` and restart. Do not put the key in chat or client code. You can set `MONTHLY_BUDGET_USD` from above zero through $30; default $20. Model calls require verified prices; see the hybrid setup below.

The computer must be awake and the server running for time to advance. Closing the browser does not stop the town. Closing the server does. On restart the world resumes its saved time, without invented catch-up events. One real day is four village days. A new world starts at 08:00 on Day 1 of spring.

For development, run `npm run dev` and `npm run client` in separate terminals, then use port 5173. The production build on port 3000 is the simplest local setup.

## Running in the background (macOS launchd)

Optionally, run the server as a launchd agent, `~/Library/LaunchAgents/com.littleelsewhere.server.plist`, so it survives closing terminals and app updates, starts at login and restarts itself if it stops. Output goes to `data/logs/server.log`. The plist is machine-specific and not part of this repository.

- Restart after changing code: `launchctl kickstart -k gui/$(id -u)/com.littleelsewhere.server`
- Stop until next login: `launchctl bootout gui/$(id -u)/com.littleelsewhere.server`
- Start again: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.littleelsewhere.server.plist`

Do not also run `npm start` while the agent is loaded; the world lock refuses a second server.

## Model selection and spending

The default is hybrid: `DECISION_MODEL=typesafe/jev-1.13` chooses a server-supplied legal action using OpenRouter's alpha Decisions API. `RESIDENT_MODEL=qwen/qwen3.5-9b` writes short dialogue, morning intentions, and evening reflections. Set `DECISION_MODEL=llm` to compare language-model-only decisions. Jev cannot generate dialogue. `NEWSPAPER_MODEL=google/gemma-4-26b-a4b-it` writes and checks the morning newspaper, using the newspaper allocation. A failed evidence check permits one bounded revision, then falls back to event highlights. Urgent eating, exhaustion and overnight rest use free simulation routines.

To connect locally, put your OpenRouter key in `.env`, then run `npm run ai:check`. This makes a small number of paid requests using the town's existing spending ledger, but leaves the saved town untouched. Restart the server after a successful check. Open Operations to inspect both configured models and service readiness. The key never goes to the browser. API failures fall back to routines with cooldowns; provider billing and model availability still require live verification.

Provisional language model: `qwen/qwen3.5-9b`. Comparison candidates are `google/gemma-4-26b-a4b-it` and `ibm-granite/granite-4.0-h-micro`. Language-model availability, advertised parameters and prices are refreshed from OpenRouter at startup and daily. Jev is not in the standard text-model catalog yet; its pinned $0.042/million input-token rate is verified against OpenRouter's listing, sent as a routing price ceiling, and checked against actual billed usage. A detected higher rate stops further Jev decisions until reviewed. Provider maximum-price filters keep routing within the reserved rates.

`npm run benchmark -- --quick` compares Jev hybrid and Qwen on six cases each. `npm run benchmark` runs identical behavioral cases against Jev hybrid and the available language-model candidates, using the configured key and the **same budget ledger** as the town. It writes `data/reports/model-comparison.json` with outputs, validity, need/commitment alignment, latency and cost. It does not automatically change the running model. Review transcripts for personality and repetition, then update `RESIDENT_MODEL` and restart. Qwen3.5 2B and Gemma 4 E2B remain watchlist models until served by OpenRouter; no second host is introduced.

All generation, repair and newspaper calls reserve a conservative maximum estimated cost transactionally before dispatch. Actual token usage or returned cost replaces the reservation. Interrupted calls with unknown billing retain the maximum estimated cost. Daily limits divide the monthly limit by calendar days in the UTC month. Resident, newspaper and repair allocations are 80/10/10%. Provider billing is ultimately authoritative; inspect Operations and your OpenRouter ledger. At budget exhaustion routines continue and editions use event highlights.

## Persistence, API and access

`data/world.sqlite` contains world state, random-generator position, accepted actions, ordered events, papers and inference accounting. WAL transactions atomically commit world changes and events. Only one simulation server may use a world database; do not run multiple replicas.

Read APIs: `/api/world`, `/api/residents/:id`, `/api/events` (after/before/kind/search/resident/limit), `/api/events/:id`, `/api/newspapers`, `/api/health`. `/live` streams authoritative snapshots with monotonic event sequence numbers. Reconnect gets current state; `/api/events?after=N` recovers event gaps. No world-mutation API exists.

Default bind is loopback only. Any non-loopback bind requires an `OWNER_TOKEN` of at least 32 characters. `/api/login` exchanges the token for an HttpOnly, SameSite cookie. All API and WebSocket reads require this cookie when a token is set. Sessions are invalidated on server restart. Cloud cookies require HTTPS. Local routine mode does not require a login.

## Validation

```sh
npm test
npm run build
node --import tsx scripts/simulate.ts 56 4217   # fast routine-only run printing daily village signals
node --import tsx scripts/map-preview.ts        # ASCII map with scenery, doors and plots
npm run test:integration
npm run soak
npm run test:browser
node --import tsx scripts/construction-browser-check.ts
npm run backup
npm run restore-check -- data/backups/<backup-file>.sqlite
```

Browser checks use an installed Chrome browser and a running server. The default soak accelerates **12 simulated days across three seeds**, including restart and evidence checks. This is not a 72-hour unattended API run. Once a key is configured, leave the computer awake and run `npm run soak -- --realtime` against the running local server for the real 72-hour operational check. Reports are written under `data/reports/`. Do not treat accelerated validation as proof of live provider uptime or model quality.

## Move to a server later

Use a Linux host with Docker Compose, initially 2 vCPUs/4 GB RAM. Point a domain to it and open ports 80/443. Copy the project and `.env` securely. Set a random `OWNER_TOKEN` (for example generated with `openssl rand -hex 32`), `DOMAIN`, and your OpenRouter key. Run:

```sh
docker compose up -d --build
```

Caddy obtains HTTPS certificates. Only Caddy publishes ports; the simulation runs behind it with a persistent `world` volume and restart policy. Keep one simulation replica. Host setup, domain purchase, and a live cloud deployment are not performed by this repository.

To migrate local history, stop the local server, create a SQLite backup, and copy it into the stopped cloud service's volume as `world.sqlite` with UID/GID 1000 ownership. Never overwrite an active database. Confirm restore-check before starting the cloud instance.

For daily encrypted **off-server** backups, configure a restic repository (such as S3-compatible object storage), password and storage credentials in `.env`. Initialize it once using `docker compose run --rm --entrypoint restic backup init`, then run `docker compose --profile backups up -d`. The backup service creates a consistent snapshot, uploads it, applies retention, verifies local restore, and removes that temporary snapshot. Check its logs for failures. Preserve the restic password separately; losing it makes backups unreadable. To recover, restore a restic snapshot into a temporary location, run restore-check, stop the village, then replace the live database and remove old WAL/SHM sidecars before restarting.

## Practical limits

Small-model narrative quality must be evaluated with your key. This is an open-ended combination of implemented mechanics, not an engine that writes and installs its own features. The renderer and map are original code-generated pixel art; no external image assets are required. Fonts fall back to system fonts if offline. A real 72-hour paid-inference soak and cloud deployment remain explicit operational acceptance steps.
