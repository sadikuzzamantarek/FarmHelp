# FarmHelper — Project Context & Session Handoff

> **Purpose:** This is the fast-load context file for FarmHelper. Read this first when starting a new session, switching AI provider/model, handing the repo to a teammate, or returning after a break. It records what the project is, how it is wired, what currently works, what is in progress, and what to do next.
>
> **Companion document:** `docs/doc.md` is the full living SRS (requirements, architecture, algorithms, project plan, risks, open decisions). This `context.md` is the short operational map; the SRS is the detailed specification.
>
> ## Update rule (must follow)
>
> 1. **Keep this file current.** After any change that affects project state — code, schema, data, commands, environment, decisions, blockers, or next steps — update the relevant section here in the same session.
> 2. **Always update the Session Handoff block and the Context Update Log** at the end of a work session.
> 3. **Record decisions, not just actions.** If a choice is made (e.g., booking model, distance filter), add it to the Decision Log here and, if it changes requirements, in `doc.md` §12.
> 4. **Do not store secrets.** Reference environment variable names only.
> 5. **Keep it short enough to skim.** Move deep detail to `doc.md`; keep pointers here.
>
> Any AI agent or developer working in this repo is expected to follow this rule. `AGENTS.md` points here.

---

## 1. Quick facts

| Field | Value |
|---|---|
| Project | FarmHelper / FarmMatch |
| What it is | Mobile platform to find, compare, and (planned) book nearby tractor, sprayer, and seed providers |
| Primary demo area | Rangpur, Bangladesh (~18 km × 18 km grid around 25.7439 N, 89.2752 E) |
| App | Expo SDK ~54 + React Native 0.81 + Expo Router ~6, TypeScript/JavaScript |
| Map | MapLibre React Native + OpenFreeMap Liberty (no API key; requires a dev build) |
| Backend | Supabase: Postgres + PostGIS + pgRouting |
| Local backend (proposed) | Supabase CLI stack in Docker: Postgres/PostGIS/pgRouting + PostgREST + Studio |
| Fallback backend | `json-server` serving `db.geo.json` + client-side Haversine ranking |
| Current stage | Prototype + farmer UI shell: matching/road routing work; tile-first Home, service-filtered Map and light/dark theme added 2026-11-16; auth/booking/provider onboarding not built |
| Git branch (last checked) | `feat/pgRouting_implementation` |
| Last context update | 2026-11-16 |

---

## 2. Session Handoff (update at end of every session)

### Current snapshot

| Item | Value |
|---|---|
| Date | 2026-11-16 |
| Branch | `feat/pgRouting_implementation` |
| Current focus | Farmer-facing UI shell: tile-first Home, service-filtered Map, light/dark theme |
| Code changes this session | Home rebuilt as a service-tile launcher; Map receives `?service=` and filters markers by service/availability; theme provider + toggle added; tab bar restructured; Supabase provider offers now loaded; map route made lazy for Expo Go; provider detail sheet, toasts, skeletons and explicit load/error/retry states added; GeoJSONSource Fragment bug fixed; **seed varieties added end-to-end** (catalogue page, 8 per-provider prices, variety-aware ranking); **Android release resource linking fixed** (`expo-font` style `regular` → `normal`) |
| Files created | `constants/services.ts`, `constants/seeds.ts`, `constants/app-theme.ts`, `contexts/app-theme.tsx`, `contexts/toast.tsx`, `components/service-tile.tsx`, `components/theme-toggle.tsx`, `components/skeleton.tsx`, `features/map/map-screen.tsx`, `features/map/provider-details.tsx`, `app/seeds.tsx`, `scripts/lib/seed-varieties.js`, `scripts/add-seed-varieties.js`, `docs/progress.md` |
| Files rewritten | `app/(tabs)/index.tsx`, `app/(tabs)/_layout.tsx`, `app/_layout.tsx`; `app/(tabs)/map.tsx` is now a lazy loader; the map implementation moved to `features/map/map-screen.tsx` |
| Files edited | `services/supabase.js`, `services/geoClient.js`, `docs/context.md` |
| Verification | `npx tsc --noEmit`, ESLint on the changed files, `npm run preview-match` (Potato seed) and `gradlew :app:processReleaseResources` passed. No `expo start` / `npm run android` was run for UI verification; device testing is pending (user). |
| Known blocker | Seed varieties are in `db.geo.json`, but the existing Supabase project needs the new `seed_varieties` column + `npm run seed-supabase` before the live app can price varieties. Until then the app falls back to the base seed price and shows a warning. |
| Next recommended action | Run the schema alter + reseed; verify the seed catalogue → map flow on the dev build; then continue with R0.2 data work |

### Work in progress

- [x] Create SRS-style project document.
- [x] Create this context/handoff document.
- [x] Add a documentation-maintenance rule to `AGENTS.md`.
- [x] Document the local-development strategy (this file §9.1).
- [x] Replace the template Home with the tile-first service launcher.
- [x] Add the service-filtered map, service marker icons and best-match highlight.
- [x] Add the app-wide light/dark theme toggle (Home + Map).
- [x] Create `docs/progress.md` as the progress tracker.
- [x] Marker tap / result tap → provider detail sheet (FR-03.7).
- [x] Toast feedback for success, no results, degraded mode and errors.
- [x] Skeleton loading for the map route, provider card and match results; button-only spinner.
- [x] Fix the MapLibre `React.Fragment` crash inside `GeoJSONSource`.
- [x] Seed catalogue page + in-map seed picker (8 varieties).
- [x] Per-variety seed prices in `db.geo.json`, the generator, the schema and the Supabase seed script.
- [x] Variety-aware ranking and provider detail prices.
- [ ] Run `supabase/schema.sql` (seed_varieties column) + `npm run seed-supabase`.
- [ ] User verification of the new UI on the Android dev build.
- [ ] Persist the theme choice on native (AsyncStorage or equivalent).
- [ ] Team review of `docs/doc.md`.
- [ ] Rebaseline the schedule in `doc.md` §9.2.
- [ ] Scaffold local Supabase CLI stack and verify pgRouting end-to-end.
- [ ] Fix known technical debt (see §10) before booking work.

### If you are a new session/provider, do this first

1. Read this file fully.
2. Read `docs/doc.md` §2 (current state), §6 (algorithms), §8 (architecture), §12 (open decisions).
3. Run `git status` and `git log --oneline -5` to see what changed since this snapshot.
4. Check `docs/context.md` §10 for known issues before editing.
5. Follow `AGENTS.md` (Expo SDK 54 versioned docs) before writing app code.

---

## 3. What the product does (one paragraph)

A farmer opens the Home screen and taps a service tile (tractor, sprayer, or seed); the map then opens already filtered to that service. The farmer enters quantity (acres or kg), a maximum distance, a budget, and a travel rate. The app finds nearby available providers, computes a total cost (service + travel), filters out anything over budget or too far, and ranks the rest with a weighted score. The best provider and the full ranked list are shown on the map, with a real road route when the pgRouting graph is available. If the road graph or Supabase is unavailable, the app degrades to Haversine distance and finally to local JSON data instead of failing.

---

## 4. Stack and environment

| Layer | Technology | Notes |
|---|---|---|
| Mobile app | Expo ~54, React Native 0.81, React 19 | `app/` uses file-based routing |
| Language | TypeScript (app shell) + JavaScript (services/utils/scripts) | `tsconfig.json`, `eslint.config.js` |
| Map | `@maplibre/maplibre-react-native` 11.5 | **Not available in Expo Go**; use `npm run android` |
| Map style | OpenFreeMap `liberty` (light) / `dark` (dark mode) | Selected in `features/map/map-screen.tsx` from the app theme |
| Theme | `contexts/app-theme.tsx` + `constants/app-theme.ts` | Manual light/dark toggle; native persistence not added yet |
| Backend | Supabase (`@supabase/supabase-js`) | Postgres + PostGIS + pgRouting |
| Local backend | `json-server` on port 3000 | Serves `db.geo.json`; URL hardcoded in `services/api.js` |
| HTTP | `axios` | 5 s timeout for json-server |
| Data scripts | Node.js | `scripts/*.js` |
| OSM parsing | Overpass API / Geofabrik PBF + `osm-pbf-parser` | Road graph build |
| Native target | Android package `com.sadikuzzamantarek.FarmerHelper` | New Architecture enabled |
| Secondary targets | iOS, web | Not the primary evaluation target |

### Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | App + scripts | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | App | Public key; RLS must protect data |
| `SUPABASE_SERVICE_ROLE_KEY` | `seed-supabase.js`, `upload-roads.js`, `check-roads.js` | **Scripts only**; never bundle into the app |

`.env` is git-ignored. `.env.example` is the template. Never commit real keys or paste them into docs.

---

## 5. Repository map — where to look for what

```
FarmerHelper/
├── app/                          # Expo Router screens
│   ├── (tabs)/_layout.tsx        # Tab bar: Home · Find · Simulator (Explore hidden)
│   ├── (tabs)/index.tsx          # Tile-first farmer Home (service launcher)
│   ├── (tabs)/explore.tsx        # Expo template screen — hidden from the tab bar
│   ├── (tabs)/map.tsx            # Lazy map route + "development build required" fallback
│   ├── (tabs)/simulate.jsx       # Form simulator with timings (prototype, old light UI)
│   ├── _layout.tsx               # Root stack + app theme provider + safe area
│   ├── seeds.tsx                 # Seed catalogue page (variety picker)
│   └── modal.tsx                 # Template modal
├── components/                   # UI primitives
│   ├── service-tile.tsx          # Home service tile (icon + label + unit)
│   ├── theme-toggle.tsx          # One-tap light/dark switch
│   ├── skeleton.tsx              # Pulsing placeholder blocks
│   └── ...                       # Expo template primitives
├── constants/
│   ├── services.ts               # Service catalogue driving Home tiles + map filter
│   ├── seeds.ts                  # Seed varieties + demo price ranges
│   ├── app-theme.ts              # FarmHelper light/dark palettes + withAlpha()
│   └── theme.ts                  # Expo template colours/fonts
├── contexts/
│   ├── app-theme.tsx             # ThemeProvider + useAppTheme()
│   └── toast.tsx                 # ToastProvider + useToast()
├── features/
│   └── map/
│       ├── map-screen.tsx        # MapLibre + matching + provider details
│       └── provider-details.tsx  # Provider sheet: services, prices, contact
├── hooks/                        # Color scheme/theme hooks
├── services/
│   ├── api.js                    # json-server client — HARDCODED LAN IP
│   ├── geoClient.js              # Chooses Supabase vs json-server; fallback ladder
│   └── supabase.js               # RPC wrappers + 8 s timeout
├── utils/
│   ├── geoEngine.js              # Haversine + ranking (current engine)
│   └── farmMatchEngine.js        # Legacy synthetic-grid Dijkstra (reference only)
├── supabase/
│   ├── schema.sql                # providers, provider_services, nearby_providers RPC
│   ├── routing-schema.sql        # pgRouting tables/functions
│   ├── road-data.json            # Generated graph (git-ignored)
│   └── road-data.sql             # Generated SQL (git-ignored)
├── scripts/
│   ├── generate-geo-data.js      # db.json → db.geo.json + providers.geojson
│   ├── lib/seed-varieties.js     # Deterministic per-variety seed prices
│   ├── add-seed-varieties.js     # Adds varieties to db.geo.json (idempotent)
│   ├── build-roads.js            # OSM → road graph JSON/SQL/GeoJSON
│   ├── upload-roads.js           # road-data.json → Supabase (batched)
│   ├── check-roads.js            # Live pgRouting sanity checks
│   ├── seed-supabase.js          # db.geo.json → providers/provider_services
│   ├── preview-match.js          # CLI ranking scenarios
│   ├── build-preview.js          # Static Leaflet preview
│   └── .cache/                   # OSM PBF cache (git-ignored)
├── preview/                      # Leaflet preview (index.html, roads.geojson)
├── db.geo.json                   # 100 synthetic providers with real coordinates + services
├── db.json                       # Legacy synthetic graph/providers/farmers
├── providers.geojson             # Provider points for map visualisation
├── docs/
│   ├── brainstorm.md             # Early notes (nearly empty)
│   ├── doc.md                    # Full SRS + working plan
│   ├── progress.md               # Work log + feature progress + next actions
│   └── context.md                # This file
├── package.json                  # Scripts and dependencies
├── app.json                      # Expo config
├── AGENTS.md                     # Agent instructions (Expo docs + context rule)
└── CLAUDE.md                     # Points to AGENTS.md
```

### Task → file quick lookup

| I need to… | Look at |
|---|---|
| Change the map UI or matching form | `features/map/map-screen.tsx` (+ `app/(tabs)/map.tsx` loader) |
| Change the Home service tiles | `constants/services.ts` + `app/(tabs)/index.tsx` |
| Add a new service (harvester, labour, …) | `constants/services.ts` (and the `service_type` check in `supabase/schema.sql`) |
| Add/change a seed variety or demo range | `constants/seeds.ts` + `scripts/lib/seed-varieties.js` |
| Change seed pricing rules | `scripts/lib/seed-varieties.js`, then `npm run add-seed-varieties` + `npm run seed-supabase` |
| Change the seed catalogue page | `app/seeds.tsx` |
| Change the in-map seed picker | `features/map/map-screen.tsx` |
| Change the map's service filter or marker icons | `features/map/map-screen.tsx` + `constants/services.ts` |
| Change the provider detail sheet | `features/map/provider-details.tsx` |
| Change toasts / success / error messages | `contexts/toast.tsx` + the screen that calls `showToast()` |
| Change loading placeholders | `components/skeleton.tsx` + the screen using it |
| Change the Expo Go / web map fallback | `app/(tabs)/map.tsx` |
| Change light/dark colours or the toggle | `constants/app-theme.ts` + `contexts/app-theme.tsx` |
| Record progress / next actions | `docs/progress.md` |
| Change scenario simulator UI | `app/(tabs)/simulate.jsx` |
| Change how a backend is chosen / fallback | `services/geoClient.js` |
| Change a Supabase RPC call | `services/supabase.js` |
| Change distance or score math | `utils/geoEngine.js` |
| Change DB tables or Haversine RPC | `supabase/schema.sql` |
| Change road routing RPCs | `supabase/routing-schema.sql` |
| Change provider data | `db.geo.json` + `scripts/seed-supabase.js` |
| Rebuild the road graph | `scripts/build-roads.js` → `scripts/upload-roads.js` |
| Test the graph | `scripts/check-roads.js` |
| Test ranking without the app | `scripts/preview-match.js` |
| Change the tab bar | `app/(tabs)/_layout.tsx` |
| Understand requirements or plan | `docs/doc.md` |
| Switch session/provider | This file |

---

## 6. Architecture and data flow

```
Expo app (Home → Map / Simulator)
   │
   ├── services/geoClient.js  ── decides road / Haversine / json-server
   │       ├── services/supabase.js ── RPCs → Supabase (PostGIS + pgRouting)
   │       └── services/api.js      ── REST  → json-server (db.geo.json)
   │
   └── utils/geoEngine.js  ── Haversine + cost/score ranking (client fallback)
```

### Match request lifecycle

1. User taps **Find best provider** on the map or simulator.
2. `runGeoMatch(req, providers)` asks `getDistanceKind()` which backend to use (cached after first probe).
3. **Road mode:** `nearby_providers_road` runs one many-to-one `pgr_dijkstra`; if it fails/times out, retry `nearby_providers` (Haversine).
4. **Haversine mode:** `nearby_providers` uses `ST_DistanceSphere`.
5. **json-server mode:** local `findBestProvider` ranks `db.geo.json` providers.
6. `rankCandidateRows` applies availability, budget, score; returns best + ranked list + `distance_kind`.
7. If road mode and a best provider exists, `road_path` fetches the polyline; otherwise the map draws a dashed straight line.

### Dependency graph

- `app/(tabs)/index.tsx` → service tiles → `router.push('/map?service=…')`.
- `app/(tabs)/map.tsx` (lazy loader) → `features/map/map-screen.tsx` → `services/geoClient` → `services/supabase` / `services/api` → `utils/geoEngine`.
- `app/(tabs)/simulate.jsx` → `services/geoClient`.
- `contexts/app-theme.tsx` → `constants/app-theme.ts`; used by Home, Map and the tab bar.
- Supabase RPCs → `providers`, `provider_services`, `road_vertices`, `road_edges`.

---

## 7. Data model and RPC contracts

### Tables

| Table | Key columns | Purpose |
|---|---|---|
| `providers` | `id`, `name`, `lat`, `lng`, generated `geog` | Provider directory; GiST-indexed geography |
| `provider_services` | `provider_id`, `service_type`, `price`, `available`, `seed_varieties jsonb` | One row per offer; PK `(provider_id, service_type)`; seed offers carry per-variety prices |
| `road_vertices` | `id`, `lon`, `lat`, generated `geom` | OSM graph nodes |
| `road_edges` | `id`, `source`, `target`, `cost`, `reverse_cost`, `geom` | OSM segments; `cost` in km; `-1` reverse = one-way |

### RPCs

| RPC | Signature | Returns |
|---|---|---|
| `nearby_providers` | `(p_lat, p_lng, p_radius_km, p_service)` | `id, name, lat, lng, distance_km, price, available` (Haversine) |
| `nearby_providers_road` | same | same, `distance_km` = road km (Dijkstra; Haversine per unreachable provider) |
| `road_distance_km` | `(f_lng, f_lat, t_lng, t_lat)` | km, or `-1` if unreachable |
| `road_path` | `(f_lng, f_lat, t_lng, t_lat)` | GeoJSON `LineString` text or `null` |
| `nearest_vertex_id` | `(p_lng, p_lat)` | nearest `road_vertices.id` |

**Client loaders:** on Supabase, `services/geoClient.js` loads `fetchAllProviders()` and `fetchAllProviderServices()` together, so every provider carries a `services` map (`price`, `price_per_acre` / `price_per_kg`, `available`). This drives marker filtering and the client-side fallback.

### Current dataset

- 100 synthetic providers (`Provider_0`…`Provider_99`) with real Rangpur coordinates.
- 210 service offers: seed 66, sprayer 73, tractor 71.
- Seed offers carry 8 varieties with deterministic per-kg prices: potato, bean, rice, maize, mustard, lentil, wheat, jute.
- Prices: per acre for tractor/sprayer; per kg for seed (base `price_per_kg` + `varieties`). Currency: Tk.
- Road graph: 33,220 vertices, 34,159 edges (~6.2 MB JSON), built from OSM for the Rangpur grid bbox.
- **Synthetic data must always be labelled as demo data.**

---

## 8. Matching business rules (must stay consistent)

### Eligibility

A provider is a candidate only if:

1. It offers the requested `service_type`.
2. `available = true`.
3. `distance_km ≤ max_distance_km`.
4. `total_cost_tk ≤ max_total_cost_tk`.

### Cost

```
service_cost = seed ? price_per_kg × kg_needed : price_per_acre × acres

# Seed requests with a selected variety:
# price_per_kg = varieties[seed_type].price_per_kg
# Providers that do not sell that variety are excluded.
# Legacy data without `varieties` uses the base price_per_kg.

travel_cost  = distance_km × travel_cost_per_km_tk
total_cost   = service_cost + travel_cost
```

### Score (lower is better)

```
score = 0.7 × (total_cost / max_total_cost_tk)
      + 0.3 × (distance_km / max_distance_km)
```

### Distance ladder

| Order | Source | Reported as |
|---|---|---|
| 1 | pgRouting road distance | `road` |
| 2 | PostGIS `ST_DistanceSphere` Haversine | `haversine` |
| 3 | Client Haversine over `db.geo.json` | `json-server` |
| 4 | Map only, no match | status badge only |

Timeouts: Supabase requests 8 s, axios 5 s. A failed first road probe caches Haversine mode; a timeout during a match degrades that match only.

---

## 9. Commands and setup

### App

```bash
npm install
npx expo start        # Expo Go — MapLibre will not work
npm run android       # Android dev build — required for MapLibre
npm run web           # Web preview
npm run lint          # ESLint
```

### Data / backend

```bash
npm run generate-geo     # db.json -> db.geo.json + providers.geojson
npm run add-seed-varieties  # add 8 per-variety seed prices to db.geo.json
npm run seed-supabase    # providers/services -> Supabase (idempotent upsert)
npm run build-roads      # OSM -> road-data.json/sql + preview/roads.geojson
npm run upload-roads     # road graph -> Supabase (batched)
npm run check-roads      # live pgRouting sanity checks
npm run preview-match    # CLI ranking scenarios
npm run build-preview    # static Leaflet preview
```

### First-time database setup order

1. Enable PostGIS and pgRouting in Supabase.
2. Run `supabase/schema.sql` (also adds `provider_services.seed_varieties` on existing projects).
3. Run `supabase/routing-schema.sql`.
4. `npm run add-seed-varieties` (only needed if `db.geo.json` was regenerated).
5. `npm run seed-supabase`.
6. `npm run build-roads`.
7. `npm run upload-roads`.
8. `npm run check-roads`.

### 9.1 Local development strategy (proposed, not implemented yet)

**Short answer: yes — and pgRouting works locally.** The Supabase CLI local stack runs the `supabase/postgres` image, which bundles PostGIS **and pgRouting**. Because the app talks to Supabase through PostgREST RPCs, keeping the same `supabase-js` calls means almost no app code changes. The database simply moves from the cloud project to Docker on your PC.

#### Options

| Option | What runs locally | App changes | Verdict |
|---|---|---|---|
| **A. Supabase CLI stack** | Postgres + PostGIS + pgRouting + PostgREST + Studio + Auth/Storage | Only `EXPO_PUBLIC_SUPABASE_URL` / keys | **Recommended** |
| B. Plain Postgres container | Postgres + PostGIS + pgRouting only | Needs PostgREST + a `/rest/v1` proxy, or a new API client | Good for SQL/routing experiments |
| C. json-server + local Postgres | UI against JSON, SQL via `psql` | None, but app still isn't using local DB | Not a full local setup |
| D. Self-hosted Supabase compose | Full Supabase stack manually | Same as A, more ops work | Overkill for now |

#### What works locally with Option A

| Capability | Local support |
|---|---|
| `providers`, `provider_services` tables | Yes |
| `nearby_providers` (PostGIS Haversine) | Yes |
| `nearby_providers_road` (pgRouting Dijkstra) | Yes — enable `pgrouting` |
| `road_distance_km`, `road_path`, `nearest_vertex_id` | Yes |
| RLS policies and `anon` role | Yes |
| Supabase Studio at `http://localhost:54323` | Yes |
| Auth / Storage / Edge Functions (future) | Yes (local GoTrue, Storage, Deno) |
| Map tiles | External OpenFreeMap; needs internet |

#### Proposed repo changes

1. Add dev dependencies: `npm i -D supabase pg`.
2. Run `npx supabase init` (creates `supabase/config.toml`; keep the existing SQL files).
3. Move schema into versioned migrations:
   - `supabase/migrations/20261115000000_extensions.sql`
   - `supabase/migrations/20261115000100_core_schema.sql`
   - `supabase/migrations/20261115000200_routing_schema.sql`
   - Add `set search_path = public, extensions;` and create extensions explicitly:
     `create extension if not exists postgis with schema extensions;`
     `create extension if not exists pgrouting with schema extensions;`
4. Generate `supabase/seed.sql` from `db.geo.json` (providers + services only, using `on conflict` upserts) so `supabase db reset` is reproducible.
5. Add `scripts/load-local-roads.js` using the `pg` client to execute `supabase/road-data.sql` (or call `upload-roads.js` with local keys). Re-run after every `db reset`.
6. Add npm scripts:
   ```json
   "db:start": "supabase start",
   "db:stop": "supabase stop",
   "db:reset": "supabase db reset",
   "db:status": "supabase status",
   "db:build-seed": "node scripts/generate-seed-sql.js",
   "db:load-roads": "node scripts/load-local-roads.js"
   ```
7. Update the scripts' `.env` loader to prefer `.env.local`, then `.env`, then `process.env`.
8. Add `docs/local-development.md` with the setup runbook (or keep this section as the source of truth and link it).

#### Local env profile (`.env.local`, git-ignored)

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from `npx supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<service-role key from `npx supabase status`>
LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

#### Device networking (important)

| Target | How to reach the local API |
|---|---|
| Web / iOS simulator | `http://localhost:54321` |
| Android emulator | `http://10.0.2.2:54321` **or** `adb reverse tcp:54321 tcp:54321` |
| Physical Android over USB | `adb reverse tcp:54321 tcp:54321`, then `http://localhost:54321` |
| Physical Android over Wi-Fi | `http://<PC-LAN-IP>:54321`; allow port 54321 in Windows Firewall |

- Expo inlines `EXPO_PUBLIC_*` at bundle time: restart Metro with `npx expo start -c` after changing env.
- Android may block cleartext HTTP in release builds; debug/dev builds usually allow it. If not, configure `usesCleartextTraffic` via `expo-build-properties`.
- Do **not** expose the local Supabase stack to an untrusted public network.

#### Verification runbook

```bash
npm i -D supabase pg
npx supabase init
npx supabase start            # first run downloads images
npx supabase status           # copy URL + anon/service keys into .env.local
npx supabase db reset         # extensions + schema + seed
npm run build-roads           # if road-data.sql/json do not exist
npm run db:load-roads         # load 33k vertices / 34k edges
```

```sql
select pgr_version();
select count(*) from road_vertices;          -- expected 33220
select count(*) from road_edges;             -- expected 34159
select road_distance_km(89.2752, 25.7439, 89.246135, 25.755885);
select count(*) from nearby_providers_road(25.7439, 89.2752, 18, 'tractor');
select road_path(89.2752, 25.7439, 89.246135, 25.755885);
analyze road_vertices;
analyze road_edges;
```

#### Caveats

- Docker Desktop needs roughly 2–4 GB RAM; the first `supabase start` pulls several images.
- `supabase db reset` wipes the local database, including the road graph — rerun the road loader.
- Never run `supabase db reset --linked`; that targets the cloud project.
- `road-data.sql` / `road-data.json` are generated and git-ignored; rebuild if missing.
- If `pgrouting` is not available, check `select * from pg_available_extensions where name = 'pgrouting';`. It is included in `supabase/postgres`; otherwise use the plain-Postgres option or a custom image.
- If the road RPC times out locally, check the `authenticator` role's `statement_timeout`; the app's 8 s client timeout still applies.
- Keep cloud Supabase as the deployment target; local is for development and benchmarking.

**Estimated effort:** 0.5–1 day for the stack + migrations + seed; another half-day for device networking, docs, and verification.

---

## 10. Current status, gaps, and technical debt

### Implemented (prototype)

- MapLibre map with provider markers, crosshair, results card.
- Service selection (tractor/sprayer/seed), acres/kg, distance/budget/travel-rate inputs.
- Supabase Haversine RPC.
- Supabase road-distance RPC via pgRouting.
- OSG road-graph build/upload pipeline.
- Road polyline rendering on the map.
- Client-side Haversine ranking fallback.
- json-server fallback.
- Simulator screen with timing output.
- CLI preview script.
- Tile-first farmer Home with an extensible service grid (Tractor, Sprayer, Seed).
- Service-filtered map with service-specific marker icons and best-match highlight.
- App-wide light/dark theme toggle; OpenFreeMap `dark` style on the map.
- Supabase provider offers loaded with providers (markers + client fallback).
- Provider detail sheet from a marker/best-card/result row: services, prices, availability, distance, contact state.
- Toast feedback for success, no results, degraded mode and errors; explicit retry on provider-load failure.
- Skeleton loading for the map route, provider card and match results.
- Seed catalogue page + in-map picker for 8 varieties (potato, bean, rice, maize, mustard, lentil, wheat, jute).
- Per-variety seed pricing in the dataset, schema, generator, seed script and ranking engine.

### Partially implemented / gaps

| ID | Gap | Impact | Suggested action |
|---|---|---|---|
| G-01 | ✅ Fixed 2026-11-16 — Home is now the tile-first farmer screen; Explore is hidden | — | — |
| G-02 | ✅ Fixed 2026-11-16 — tab bar explicitly configures Home, Find (map), Simulator | — | — |
| G-03 | `services/api.js` hardcodes `http://192.168.1.112:3000` | Breaks for other developers/devices | Move to `EXPO_PUBLIC_API_BASE_URL` |
| G-04 | ✅ Fixed 2026-11-16 — Supabase mode now loads `provider_services` with providers | — | — |
| G-05 | `rankCandidateRows()` does not re-check `max_distance_km` after road distance | Road candidates may exceed radius | Decide D-07 and implement post-road filter |
| G-06 | No auth, profiles, or roles | Cannot support provider accounts/booking | Phase 5–6 |
| G-07 | No booking/request persistence | Core target feature missing | Add `farmer_requests`, `bookings` |
| G-08 | Availability is static demo data | No real-time booking | Provider workspace |
| G-09 | No automated tests or CI | Regressions likely | Unit tests for formulas, RPC integration tests |
| G-10 | No staging/prod Supabase split | Data-accident risk | Create separate projects |
| G-11 | No structured logging/telemetry | Hard to diagnose field issues | Add client logger + match events |
| G-12 | Road graph only covers Rangpur bbox | Wrong/failed routing outside | Detect bbox and fall back; document coverage |
| G-13 | No GPS permission flow (map center used) | Less convenient/accurate | Add optional `expo-location` |
| G-14 | ✅ Fixed 2026-11-16 — Map card and Home footer show OpenStreetMap credit | — | — |
| G-15 | Input validation is thin (numeric coercion only) | Bad requests / divide-by-zero | Add validation + tests |
| G-16 | Theme choice is not persisted on native (web uses `localStorage`) | App returns to the phone theme after restart | Add AsyncStorage and rebuild the dev client |
| G-17 | Simulator screen still uses the old light-themed UI | Style mismatch in a demo | Reskin after the farmer flow is stable |
| G-18 | ✅ Fixed 2026-11-16 — tapping a marker, best card or result row opens provider details | — | — |
| G-19 | Provider phone numbers are not in `providers`/`provider_services` | Detail sheet can only show "not shared yet" | Add `phone` to the provider model when onboarding is built |
| G-20 | Existing Supabase projects need `provider_services.seed_varieties` added and reseeded | Live seed prices fall back to the base price (with an explicit warning) until then | Run `supabase/schema.sql` + `npm run seed-supabase` |

### Explicit non-goals right now

Payments, real-time fleet tracking, crop advice, government integration, full offline maps, multi-district rollout, iOS App Store release.

---

## 11. Conventions and gotchas

- **Expo docs are versioned:** read <https://docs.expo.dev/versions/v54.0.0/> before writing app code (per `AGENTS.md`).
- **MapLibre needs a dev build:** don't promise map testing in Expo Go.
- **Never import MapLibre at the route module top level.** `app/(tabs)/map.tsx` lazy-loads `features/map/map-screen.tsx` behind an error boundary, so Expo Go / web show a "development build required" notice instead of crashing the whole route tree.
- **Never put a React Fragment directly inside `<GeoJSONSource>`.** MapLibre clones each child with a `source` prop; a Fragment receives it and throws `Invalid prop ... supplied to React.Fragment`. Pass a **keyed array of `<Layer>` elements** instead (fixed 2026-11-16).
- **No silent fallback:** every load failure, degraded distance mode, no-result match and invalid input must call `showToast(...)` and set the status pill. The provider-load failure also renders a retry card.
- **Loading is skeleton-first:** use `components/skeleton.tsx` for content areas; only buttons may use `ActivityIndicator`.
- **Provider contact:** `providers` has no phone column yet. The detail sheet supports `phone` / `contact_phone` when present and otherwise explains that contact is shared after an accepted booking.
- **Service catalogue is the single source of truth:** add a service to `constants/services.ts`; the Home grid, map filter, marker icon and quantity label all read from it. Keep IDs in sync with the DB `service_type` check.
- **Seed IDs are duplicated deliberately:** `constants/seeds.ts` (UI) and `scripts/lib/seed-varieties.js` (data generation) must list the same 8 IDs. `provider_services.seed_varieties` uses the same JSON keys.
- **Seed pricing:** when a seed variety is selected, price = `varieties[seed_id].price_per_kg`; providers without that variety are excluded. Legacy data uses the base `price_per_kg` and the app shows a warning. Re-run `npm run add-seed-varieties` + `npm run seed-supabase` after data changes.
- **Home → Map contract:** `router.push({ pathname: "/map", params: { service } })`. The map validates the param with `getService()` and ignores unknown values.
- **New screens use `useAppTheme()`**, not the template `Colors` / `useColorScheme`, so the light/dark toggle reaches them. Template components still follow the phone setting.
- **Map styles:** light = OpenFreeMap `liberty`; dark = OpenFreeMap `dark` (verified to exist, no API key).
- **Theme persistence:** web saves the choice in `localStorage`; native is session-only until AsyncStorage is added.
- **Expo font style:** in `app.json` → `expo-font`, Android accepts `"style": "normal" | "italic"`. `"regular"` causes AAPT `fontStyle` enum failures in release builds; the generated `android/.../res/font/xml_*.xml` uses `app:fontStyle="normal"`.
- **Two distance modes, one result shape:** every backend must return `{ best_provider, best_distance_km, best_total_cost_tk, ranked_candidates, dijkstra_time_ms, ranking_time_ms, success, distance_kind }`.
- **Distance kind is cached:** `_distanceKind` in `services/geoClient.js`; restart the app to re-probe after fixing routing.
- **Road distance ≥ straight-line distance** (except fallback cases); use this as a sanity check.
- **One-way roads:** `reverse_cost = -1`; routing calls use `directed := false` with reverse-cost semantics.
- **Rural OSM gaps are normal:** some providers are not connected to the drivable graph; the SQL falls back to Haversine per provider.
- **Never ship the service-role key:** it belongs only in `.env` and Node scripts.
- **Keep synthetic data labelled:** `Provider_N` is not a real business.
- **Coordinate order:** database/GeoJSON uses `(lng, lat)`; app state uses `{ lat, lng }`. MapLibre props use `[lng, lat]`.
- **PostgREST timeout:** keep RPCs single-query and batched; avoid one Dijkstra per provider.
- **`db.geo.json` readiness:** grid generated from `db.json`; changing grid/region means regenerating and rebuilding roads.

---

## 12. Decision log

Add new decisions here (and to `doc.md` §12 if requirements change).

| Date | Decision | Rationale | Alternatives |
|---|---|---|---|
| 2026-11-12 | Use a single `context.md` as the operational handoff file | Easy for any session/provider to reload context | Per-topic notes, wiki |
| 2026-11-12 | Keep `doc.md` as the detailed SRS and `context.md` as the short map | Avoid duplicating deep specification | One giant file |
| 2026-11-12 | Prefer Supabase road routing, fall back to Haversine, then json-server | Never block the farmer on one backend | Hard fail, queue retry |
| 2026-11-16 | Home is a service-tile launcher; the map opens filtered by the chosen service | Farmer picks the job first; fewer irrelevant pins; each tile is deep-linkable | Map-first home, dropdown-only service picker |
| 2026-11-16 | The service catalogue lives in `constants/services.ts` | Adding harvester/labour/transport is a one-object change | Hardcoded tiles per screen |
| 2026-11-16 | App theme is a context with a manual light/dark toggle; map uses OpenFreeMap `dark` | Farmer-friendly readability and a controlled demo; no new native dependency | Per-screen colours, system-only theme |
| 2026-11-16 | Supabase `provider_services` are loaded with providers | Needed for service-filtered markers and the client fallback (fixes G-04) | Marker filter based on names / show all pins |
| 2026-11-16 | Provider details open in a bottom sheet from a pin, the best card or a result row | Farmers need services, price and contact in one place (FR-03.7) | Separate detail screen; no details |
| 2026-11-16 | All async outcomes use the global toast + status pill; provider-load failure also shows a retry card | No silent fallback: the farmer must know whether it worked and why | Silent console logs; alert dialogs |
| 2026-11-16 | Content loading uses skeletons; only buttons use a spinner | Avoids blank screens and old-style spinners | Full-screen spinner; blank map |
| 2026-11-16 | Seed varieties use one `seed_varieties jsonb` column on `provider_services`, not a new table | One row per provider/service stays intact; RLS and the existing RPC need no change | `provider_seed_offers` table; one row per variety |
| 2026-11-16 | Seed tile opens a catalogue page; the map also has an inline seed picker | The catalogue satisfies the "different page" requirement while the picker keeps matching fast | Map-only picker; catalogue-only flow |

### Open decisions (see `doc.md` §12 for full list)

- D-01: synthetic vs real provider data for the demo.
- D-02: booking model (instant vs request/accept).
- D-03: payment scope.
- D-07: re-apply max distance after road distance.
- D-08: tie-breaker for equal scores.
- D-12: keep json-server as an official offline mode.
- D-13: GPS default vs map-center default.
- D-18: providers outside the road bbox.

---

## 13. Context update log

| Date | Version | Change | By |
|---|---|---|---|
| 2026-11-12 | 0.1 | Created `context.md`; documented stack, repo map, architecture, rules, current gaps, handoff snapshot | AI draft for Sadik |
| 2026-11-12 | 0.1 | Created `docs/doc.md` (SRS + working plan) | AI draft for Sadik |
| 2026-11-12 | 0.1 | Added documentation-maintenance rule to `AGENTS.md` | AI draft for Sadik |
| 2026-11-15 | 0.1 | Added local-development strategy (§9.1): Supabase CLI stack, pgRouting support, migrations/seed/road-loader plan, device networking, caveats | AI draft for Sadik |
| 2026-11-16 | 0.2 | Farmer UI shell: tile-first Home, service-filtered Map with service icons and best-match highlight, light/dark theme (Home + Map + tabs), themed tab bar, Supabase offers loaded with providers; added `docs/progress.md`; marked G-01/G-02/G-04 fixed | AI draft for Sadik |
| 2026-11-16 | 0.3 | Guarded the Map route: `app/(tabs)/map.tsx` now lazy-loads `features/map/map-screen.tsx` behind an error boundary, so Expo Go/web show a build notice and Home/Simulator stay usable; fixes the "missing default export"/"No route named map" cascade caused by the native module | AI draft for Sadik |
| 2026-11-16 | 0.4 | Fixed the `GeoJSONSource` Fragment crash (keyed Layer array); added the provider detail sheet (services/prices/availability/distance/contact), global toast feedback, skeleton loading, explicit provider-load error + retry, and no-silent-fallback status tones | AI draft for Sadik |
| 2026-11-16 | 0.5 | Seed varieties end-to-end: seed catalogue page, in-map picker, 8 per-variety prices for 66 providers, `provider_services.seed_varieties`, variety-aware ranking and provider detail prices; added `add-seed-varieties` script | AI draft for Sadik |
| 2026-11-16 | 0.6 | Fixed Android release build: `expo-font` `style: "regular"` is invalid (AAPT fontStyle enum); changed `app.json` to `"normal"` and patched the generated `xml_bangla_font.xml`. `:app:processReleaseResources` now passes | AI draft for Sadik |

---

## 14. Copy-paste bootstrap prompt for a new session/provider

Paste this when starting with a different AI provider or a fresh session:

```text
You are working in the FarmHelper repository at F:\University\Final-Year-Project\FarmerHelper.

Before doing anything:
1. Read FarmerHelper/docs/context.md fully.
2. Read FarmerHelper/docs/doc.md sections 2 (current state), 6 (algorithms),
   8 (architecture), and 12 (open decisions).
3. Read FarmerHelper/AGENTS.md and follow the Expo SDK 54 versioned docs rule.
4. Run `git status` and `git log --oneline -5` to see recent changes.

Then:
- Treat docs/context.md as the living project state. Update its Session Handoff
  block and Context Update Log after any meaningful change.
- Do not overwrite uncommitted user changes (check git status first).
- Never commit or print secrets from .env.
- Keep the matching result contract and degradation ladder consistent.
- Ask before changing data semantics, scoring rules, or the database schema.

Current focus: <fill in>
Next action: <fill in>
```

---

*Keep this file accurate. A stale context file is worse than no context file.*
