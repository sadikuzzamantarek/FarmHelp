# FarmHelper — Progress Tracker

| Field | Value |
|---|---|
| Purpose | A short, honest log of what is built, what is in progress, and what comes next |
| Owner | Md Sadik Uz Zaman |
| Started | 2026-11-16 |
| Companion docs | `docs/context.md` (session handoff) · `docs/doc.md` (SRS) · `docs/PRD.md` |

> **Update rule:** add one row to the Work Log after each work session. Keep
> "Done" claims to things you actually ran on a device or verified with a
> command. Move finished backlog items to the Done column instead of deleting
> them — the thesis needs a record of the work.

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Done and verified (device or command) |
| 🟡 | Implemented, needs device verification |
| 🚧 | In progress |
| ⬜ | Not started |
| 🧊 | Design-only / deferred |

---

## 1. Release snapshot

| Release | Theme | Status | Notes |
|---|---|---|---|
| R0.1 | Map + matching + road routing prototype | ✅ | Existing prototype, unchanged this session |
| R0.2 (UI shell) | Tile-first Home, service-aware Map, seed catalogue, provider details, light/dark theme | 🟡 | Code complete; needs `npm run android` check by the user |
| R0.2 (data) | Auth, saved lands, GPS, validation, offline cache | ⬜ | Not started |
| R0.3 | Provider profile + onboarding + booking | ⬜ | Not started |
| R0.4 | Job tracking, ratings, notifications | ⬜ | Not started |
| R0.5 | NASA/soil insight + crop suggestion | ⬜ | Not started |
| R1.0 | Ledger-lite, admin, hardening, pilot | 🧊 | Deferred |

---

## 2. Feature progress (prototype view)

| Feature | Status | Where | Notes |
|---|---|---|---|
| Provider discovery + ranking | ✅ | `utils/geoEngine.js`, Supabase RPCs | Working prototype |
| Road-distance routing + polyline | ✅ | `supabase/routing-schema.sql`, `services/supabase.js` | Working prototype |
| Haversine / json-server fallback | ✅ | `services/geoClient.js` | Working prototype |
| Simulator screen | ✅ | `app/(tabs)/simulate.jsx` | Untouched; still light-themed |
| Tile-first Home screen | 🟡 | `app/(tabs)/index.tsx` | New |
| Service catalogue (extensible) | 🟡 | `constants/services.ts` | Add one object to add a tile |
| Service-filtered map + service icons | 🟡 | `features/map/map-screen.tsx` | New |
| Provider detail sheet (pin / result tap) | 🟡 | `features/map/provider-details.tsx` | Services, prices, availability, distance, contact state |
| Seed catalogue page (8 varieties) | 🟡 | `app/seeds.tsx`, `constants/seeds.ts` | Potato, bean, rice, maize, mustard, lentil, wheat, jute |
| Per-variety seed prices | 🟡 | `db.geo.json`, `provider_services.seed_varieties`, `utils/geoEngine.js` | 66 providers × 8 varieties; deterministic demo prices |
| Toast + explicit status disclosure | 🟡 | `contexts/toast.tsx`, map screen | No silent fallback |
| Skeleton loading + retry | 🟡 | `components/skeleton.tsx`, map route/screen | No blank screens or full-screen spinner |
| Light/dark theme toggle | 🟡 | `contexts/app-theme.tsx`, `components/theme-toggle.tsx` | Persists on web only |
| Supabase offers loaded for markers/fallback | 🟡 | `services/supabase.js`, `services/geoClient.js` | Fixes G-04 |
| Auth / profiles / roles | ⬜ | — | Blocks booking |
| Saved lands + marks | ⬜ | — | R0.2 |
| Booking + chat + jobs | ⬜ | — | R0.3/R0.4 |
| NASA/soil + crop suggestion | ⬜ | — | R0.5 |
| Automated tests | ⬜ | — | Recommended next engineering task |

---

## 3. Work log

| Date | Work | Files | Verification |
|---|---|---|---|
| 2026-11-16 | Replaced the Expo template Home with a farmer-facing tile grid (Tractor, Sprayer, Seed + "more services" placeholder), a hero, and a "How it works" card | `app/(tabs)/index.tsx`, `components/service-tile.tsx`, `constants/services.ts` | `npx tsc --noEmit` passed; `npx expo lint` passed; device check pending |
| 2026-11-16 | Home tile taps open the Map with `?service=tractor|sprayer|seed` | `app/(tabs)/index.tsx`, `app/(tabs)/map.tsx` | Typecheck passed |
| 2026-11-16 | Map now filters markers to the selected service, uses service-specific marker icons, highlights the best match, limits pins to eligible providers after a search, and resets results when the service changes | `features/map/map-screen.tsx` | Typecheck passed |
| 2026-11-16 | Added an app-wide light/dark theme with a one-tap toggle on Home and Map; map switches to OpenFreeMap `dark` style in dark mode | `contexts/app-theme.tsx`, `constants/app-theme.ts`, `components/theme-toggle.tsx`, `app/_layout.tsx`, `app/(tabs)/map.tsx` | Typecheck passed |
| 2026-11-16 | Restructured the tab bar (Home · Find · Simulator), hid the template Explore tab, themed the tab bar | `app/(tabs)/_layout.tsx` | Typecheck passed |
| 2026-11-16 | Loaded `provider_services` with the provider list so markers can be filtered and the client fallback can rank Supabase providers | `services/supabase.js`, `services/geoClient.js` | Typecheck passed; needs Supabase run |
| 2026-11-16 | Split the map implementation into `features/map/map-screen.tsx` and made the route lazy + error-bounded, so Expo Go / web show a "development build required" notice instead of crashing the app | `app/(tabs)/map.tsx`, `features/map/map-screen.tsx` | Typecheck + lint passed; Expo Go fallback to be re-tested by the user |
| 2026-11-16 | Fixed the MapLibre `React.Fragment` crash inside `GeoJSONSource` by passing a keyed array of `Layer` elements instead of a Fragment | `features/map/map-screen.tsx` | Typecheck + lint passed |
| 2026-11-16 | Added a provider detail sheet: tap a pin, the best card or a result row to see name, services, prices, availability, distance and contact state | `features/map/provider-details.tsx`, `features/map/map-screen.tsx` | Typecheck + lint passed |
| 2026-11-16 | Added a global toast system and explicit status tones for load failure, offline data, road fallback, success, no results and invalid input; provider-load failure has a retry card | `contexts/toast.tsx`, `app/_layout.tsx`, `features/map/map-screen.tsx` | Typecheck + lint passed |
| 2026-11-16 | Replaced blank/spinner loading with skeletons for the map route, provider card and match results; the search button uses a small spinner while matching | `components/skeleton.tsx`, `app/(tabs)/map.tsx`, `features/map/map-screen.tsx` | Typecheck + lint passed |
| 2026-11-16 | Added 8 seed varieties to the dataset (66 providers) with deterministic per-variety prices; regenerating the dataset preserves them | `scripts/lib/seed-varieties.js`, `scripts/add-seed-varieties.js`, `scripts/generate-geo-data.js`, `db.geo.json` | `npm run add-seed-varieties` + `npm run preview-match` passed |
| 2026-11-16 | Added the seed catalogue page and the in-map seed picker; Seed tile now opens the catalogue | `app/seeds.tsx`, `constants/seeds.ts`, `app/(tabs)/index.tsx`, `features/map/map-screen.tsx` | Typecheck + lint passed |
| 2026-11-16 | Seed requests now rank by the selected variety's price; providers without that variety are excluded; provider details list every variety's price | `utils/geoEngine.js`, `services/geoClient.js`, `features/map/provider-details.tsx` | `preview-match` Potato scenario returned 11 providers |
| 2026-11-16 | Added `provider_services.seed_varieties` and included it in the Supabase seed script | `supabase/schema.sql`, `scripts/seed-supabase.js` | SQL/script updated; database run pending |
| 2026-11-16 | Fixed the Android release build: Expo font config used `"style": "regular"`, which AAPT rejects (valid: `normal` / `italic`); updated `app.json` and the generated `xml_bangla_font.xml` | `app.json`, `android/app/src/main/res/font/xml_bangla_font.xml` | `gradlew :app:processReleaseResources` → BUILD SUCCESSFUL |

**Verification commands used this session**

```bash
npx tsc --noEmit          # passed
npx eslint <changed files>  # passed
npm run preview-match     # passed (Potato seed scenario)
.\gradlew.bat :app:processReleaseResources  # passed (Windows, from android/)
```

No `npx expo start` / `npm run android` was run by the assistant. The user
will verify on the dev build.

---

## 4. UI decisions made this session

| Decision | Rationale |
|---|---|
| Home is a service-tile launcher, not the map | Farmer picks the job first; the map then opens already filtered |
| Service list is data, not hardcoded UI | `constants/services.ts` is the single place to add harvester, labour, transport, etc. |
| Map receives the service through a route param | Keeps Home and Map decoupled and makes every tile deep-linkable |
| Markers are filtered by service + availability | Removes irrelevant pins and matches the "relevant provider only" requirement |
| Service-specific marker icons and accent colours | Icon-first recognition for low-literacy users |
| Best match marker is highlighted | The farmer sees the recommendation on the map, not only in the card |
| Theme is an app-level context, not a per-screen prop | One toggle updates tabs, navigation, Home and Map consistently |
| Map dark mode uses OpenFreeMap's `dark` style | Verified the style URL exists; no API key needed |
| No new native dependencies | Avoids forcing a new dev build before the user verifies the UI |
| Provider details open in a bottom sheet | One place for services, prices, distance and contact; no extra route |
| Every async outcome gets a toast + status pill | No silent fallback: the farmer always knows if the search worked and why |
| Skeletons for content, spinner only inside buttons | Avoids blank screens and old-style full-screen spinners |
| Contact is shown only when the provider model has a phone | Honest demo data; phone sharing is planned for after an accepted booking |
| Seed varieties are stored as one `seed_varieties` JSONB column | Keeps one row per provider/service and avoids changing the RPC contract |
| Seed prices derive deterministically from the provider's base seed price | Regenerating the dataset produces stable, reproducible demo prices |
| Seed tile opens a catalogue page, with an in-map picker as a shortcut | Satisfies the "different page" request without slowing down repeat searches |

---

## 5. Known limitations (this UI slice)

| ID | Limitation | Impact | Next step |
|---|---|---|---|
| UI-01 | Theme choice is not persisted on native (web uses `localStorage`) | App returns to the phone theme after restart | Add `@react-native-async-storage/async-storage` and rebuild the dev client |
| UI-02 | Simulator screen is still the old light-themed UI | Visible style mismatch when demoing | Reskin after the main flow is stable |
| UI-03 | The App still contains Expo template components (`explore`, `modal`, themed primitives) | Unused code and duplicate palettes | Remove after the farmer flow replaces them |
| UI-04 | ✅ Fixed 2026-11-16 — tapping a pin, best card or result row opens provider details | — | — |
| UI-05 | No "use my location" button (no `expo-location` installed) | Farmer must pan the map | Add `expo-location` when the data layer is built |
| UI-06 | Only three services exist; the "More services" tile is a placeholder | Expected for now | Add entries to `constants/services.ts` as services are agreed |
| UI-07 | No Bangla strings yet | Demo path is English | Add `i18n/` and Bangla labels for Home + Map first |
| UI-08 | The map does not exist in Expo Go (MapLibre is a native module) | Map tab shows a build notice; use `npm run android` | Expected: the app must be tested in its own dev build |
| UI-09 | Provider phone numbers are not in the database | Detail sheet shows "not shared yet" | Add `phone` during provider onboarding (R0.3) |
| UI-10 | Seed varieties are not yet in the live Supabase project | Until SQL + reseed, the app uses base seed prices and shows a warning | Run `supabase/schema.sql` then `npm run seed-supabase` |

---

## 6. Next actions (recommended order)

1. **Run the Supabase update** (user): `supabase/schema.sql` → `npm run seed-supabase` → reload the app.
2. **Verify on the Android dev build**: Home → Seed → catalogue → Potato → map → match → provider details.
3. Fix any layout issues found on a small screen (360×640) and a large one.
4. Add `phone` to the provider model (schema + onboarding) so the contact row can show a real number.
5. Add optional GPS ("use my location") with `expo-location` — requires a dev-build rebuild.
6. Start the R0.2 data work: `supabase/migrations/` baseline, anonymous auth, saved lands.

---

## 7. Thesis track

| Item | Status | Notes |
|---|---|---|
| Matching + road-routing prototype | ✅ | Core technical contribution exists |
| Evaluation harness (road vs Haversine, 150–200 requests) | ⬜ | Build before feature freeze; ~1–2 days |
| Usability test (5–8 farmers) | ⬜ | Recruit early; lead time 1–2 weeks |
| Agronomy reviewer for crop rules | ⬜ | Needed before R0.5 |
| Final scope confirmed (D-33 core tier) | ⬜ | Recommended cut in `doc.md` §9.8 |
| Demo reset script | ⬜ | Needed for reliable demo day |

---

## 8. Changelog

| Date | Change |
|---|---|
| 2026-11-16 | Created this tracker; recorded the tile-first Home + service-filtered Map + light/dark theme session |
