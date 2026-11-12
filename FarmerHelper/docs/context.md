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
| Fallback backend | `json-server` serving `db.geo.json` + client-side Haversine ranking |
| Current stage | Working prototype: matching + road routing work; product flow (auth, booking, provider onboarding) not built |
| Git branch (last checked) | `feat/pgRouting_implementation` |
| Last context update | 2026-11-12 |

---

## 2. Session Handoff (update at end of every session)

### Current snapshot

| Item | Value |
|---|---|
| Date | 2026-11-12 |
| Branch | `feat/pgRouting_implementation` |
| Current focus | Documentation baseline: SRS + this context file |
| Code changes this session | None (docs only) |
| Files created | `docs/doc.md`, `docs/context.md` |
| Files touched by user (do not overwrite) | `app/(tabs)/_layout.tsx` shows as modified in `git status` |
| Known blocker | None |
| Next recommended action | Review `docs/doc.md`, resolve open decisions (`D-01`…`D-18`), then start Phase 4 (farmer flow productization) |

### Work in progress

- [x] Create SRS-style project document.
- [x] Create this context/handoff document.
- [x] Add a documentation-maintenance rule to `AGENTS.md`.
- [ ] Team review of `docs/doc.md`.
- [ ] Rebaseline the schedule in `doc.md` §9.2.
- [ ] Fix known technical debt (see §10) before booking work.

### If you are a new session/provider, do this first

1. Read this file fully.
2. Read `docs/doc.md` §2 (current state), §6 (algorithms), §8 (architecture), §12 (open decisions).
3. Run `git status` and `git log --oneline -5` to see what changed since this snapshot.
4. Check `docs/context.md` §10 for known issues before editing.
5. Follow `AGENTS.md` (Expo SDK 54 versioned docs) before writing app code.

---

## 3. What the product does (one paragraph)

A farmer opens a map, picks a service (tractor, sprayer, or seed), enters quantity (acres or kg), a maximum distance, a budget, and a travel rate. The app finds nearby available providers, computes a total cost (service + travel), filters out anything over budget or too far, and ranks the rest with a weighted score. The best provider and the full ranked list are shown on the map, with a real road route when the pgRouting graph is available. If the road graph or Supabase is unavailable, the app degrades to Haversine distance and finally to local JSON data instead of failing.

---

## 4. Stack and environment

| Layer | Technology | Notes |
|---|---|---|
| Mobile app | Expo ~54, React Native 0.81, React 19 | `app/` uses file-based routing |
| Language | TypeScript (app shell) + JavaScript (services/utils/scripts) | `tsconfig.json`, `eslint.config.js` |
| Map | `@maplibre/maplibre-react-native` 11.5 | **Not available in Expo Go**; use `npm run android` |
| Map style | `https://tiles.openfreemap.org/styles/liberty` | Hardcoded in `app/(tabs)/map.tsx` |
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
│   ├── (tabs)/_layout.tsx        # Tab bar (Home, Explore, Simulate; map route not explicitly configured)
│   ├── (tabs)/index.tsx          # Template Home — placeholder
│   ├── (tabs)/explore.tsx        # Template Explore — placeholder
│   ├── (tabs)/map.tsx            # Main MapLibre matching screen (prototype)
│   ├── (tabs)/simulate.jsx       # Form simulator with timings (prototype)
│   ├── _layout.tsx               # Root stack + theme
│   └── modal.tsx                 # Template modal
├── components/                   # UI primitives from Expo template
├── constants/theme.ts            # Colors/fonts
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
│   └── context.md                # This file
├── package.json                  # Scripts and dependencies
├── app.json                      # Expo config
├── AGENTS.md                     # Agent instructions (Expo docs + context rule)
└── CLAUDE.md                     # Points to AGENTS.md
```

### Task → file quick lookup

| I need to… | Look at |
|---|---|
| Change the map UI or matching form | `app/(tabs)/map.tsx` |
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
Expo app (map/simulate)
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

- `app/(tabs)/map.tsx` → `services/geoClient` → `services/supabase` / `services/api` → `utils/geoEngine`.
- `app/(tabs)/simulate.jsx` → `services/geoClient`.
- Supabase RPCs → `providers`, `provider_services`, `road_vertices`, `road_edges`.

---

## 7. Data model and RPC contracts

### Tables

| Table | Key columns | Purpose |
|---|---|---|
| `providers` | `id`, `name`, `lat`, `lng`, generated `geog` | Provider directory; GiST-indexed geography |
| `provider_services` | `provider_id`, `service_type`, `price`, `available` | One row per offer; PK `(provider_id, service_type)` |
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

### Current dataset

- 100 synthetic providers (`Provider_0`…`Provider_99`) with real Rangpur coordinates.
- 210 service offers: seed 66, sprayer 73, tractor 71.
- Prices: per acre for tractor/sprayer; per kg for seed. Currency: Tk.
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
npm run seed-supabase    # providers/services -> Supabase (idempotent upsert)
npm run build-roads      # OSM -> road-data.json/sql + preview/roads.geojson
npm run upload-roads     # road graph -> Supabase (batched)
npm run check-roads      # live pgRouting sanity checks
npm run preview-match    # CLI ranking scenarios
npm run build-preview    # static Leaflet preview
```

### First-time database setup order

1. Enable PostGIS and pgRouting in Supabase.
2. Run `supabase/schema.sql`.
3. Run `supabase/routing-schema.sql`.
4. `npm run seed-supabase`.
5. `npm run build-roads`.
6. `npm run upload-roads`.
7. `npm run check-roads`.

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

### Partially implemented / gaps

| ID | Gap | Impact | Suggested action |
|---|---|---|---|
| G-01 | Home and Explore are template screens | Demo looks unfinished | Replace with farmer dashboard / help |
| G-02 | Map route not explicitly configured in `app/(tabs)/_layout.tsx` | Tab order/title/icon may be default | Add explicit `Tabs.Screen` for `map` |
| G-03 | `services/api.js` hardcodes `http://192.168.1.112:3000` | Breaks for other developers/devices | Move to `EXPO_PUBLIC_API_BASE_URL` |
| G-04 | Supabase-mode providers are loaded with `services: {}` | Client fallback cannot rank if both RPCs fail | Fetch service offers or rely on RPC fallback |
| G-05 | `rankCandidateRows()` does not re-check `max_distance_km` after road distance | Road candidates may exceed radius | Decide D-07 and implement post-road filter |
| G-06 | No auth, profiles, or roles | Cannot support provider accounts/booking | Phase 5–6 |
| G-07 | No booking/request persistence | Core target feature missing | Add `farmer_requests`, `bookings` |
| G-08 | Availability is static demo data | No real-time booking | Provider workspace |
| G-09 | No automated tests or CI | Regressions likely | Unit tests for formulas, RPC integration tests |
| G-10 | No staging/prod Supabase split | Data-accident risk | Create separate projects |
| G-11 | No structured logging/telemetry | Hard to diagnose field issues | Add client logger + match events |
| G-12 | Road graph only covers Rangpur bbox | Wrong/failed routing outside | Detect bbox and fall back; document coverage |
| G-13 | No GPS permission flow (map center used) | Less convenient/accurate | Add optional `expo-location` |
| G-14 | No OSM attribution visible in app | Licence non-compliance risk | Add attribution text/link |
| G-15 | Input validation is thin (numeric coercion only) | Bad requests / divide-by-zero | Add validation + tests |

### Explicit non-goals right now

Payments, real-time fleet tracking, crop advice, government integration, full offline maps, multi-district rollout, iOS App Store release.

---

## 11. Conventions and gotchas

- **Expo docs are versioned:** read <https://docs.expo.dev/versions/v54.0.0/> before writing app code (per `AGENTS.md`).
- **MapLibre needs a dev build:** don't promise map testing in Expo Go.
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
