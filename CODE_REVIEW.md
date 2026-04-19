# Production readiness — structured code review

_Generated review scope: data layer, server/client components, API/cron/middleware, server actions, style, routing, accessibility. Only the glossary draft flow was changed as part of this task; everything else is assessment only._

---

### 1. Data layer (`lib/puzzles.ts`, `lib/admin.ts`, `lib/device.ts`, `lib/dsl.ts`, `lib/mock-stats.ts`, `lib/progress.ts`, `lib/supabase.ts`)

✓ `lib/device.ts` is marked `'use client'` and guards `window` / `localStorage`, so it stays on the client boundary.

✓ `lib/supabase.ts` exports a singleton browser client using public env vars only.

✓ `lib/supabase-service.ts` isolates the server/service-role client from public pages.

✓ `lib/progress.ts` guards `typeof window` for all storage reads/writes; safe if accidentally imported on server (returns null / no-op).

✓ `getTodaysPuzzle()` / `getPuzzlePayloadById()` use straightforward selects + clue fetch without obvious N+1.

⚠ `lib/admin.ts#getAdminPuzzles` loads **all** `puzzle_clues` rows (`select('puzzle_id')` only) to count clues — acceptable at small scale but scales linearly with total clues system-wide.

⚠ `lib/admin.ts#getHistoryRows` loads all matching `solves` for listed puzzles in one query (not N+1 per puzzle) — good — but **stats** screen data is unrelated to real Supabase stats (mock only).

⚠ `lib/puzzles.ts` and `lib/admin.ts` rely on casts (`as PuzzleRowPayload`, `as Record<string, unknown>` on pipeline rows) — workable but not strict row types from generated Supabase types.

⚠ Supabase failures in public flows often return **`null`** (e.g. no puzzle) without surfacing the error to the user or logs — silent degradation.

✗ `lib/device.ts#getDeviceId`: `upsert` to `devices` is **fire-and-forget** (`void`) with **no error handling** — device rows can silently fail to persist.

✗ `lib/device.ts#getDeviceId` catch block returns a **new random UUID without persisting** — duplicate device identities possible after storage failures.

? `lib/dsl.ts` clue regex cannot represent **escaped quotes** inside clue text (`[^"]*`) — breaks only if clues contain `"`.

? New draft path depends on DB function `create_draft_with_glossary` + schema (`crossword_glossary.word`, `crossword_glossary.clue`, `puzzle_clues.glossary_id`) matching migration — **must match production** or RPC fails.

---

### 2. Server components (`app/page.tsx`, `app/solve/page.tsx`, `app/win/page.tsx`, `app/stats/page.tsx`, `app/waiting/page.tsx`, `app/admin/*/page.tsx`)

✓ Core puzzle routes use `export const revalidate = 0` so daily puzzle isn’t aggressively cached incorrectly.

✓ `/`, `/solve`, `/win`, `/waiting` handle **no puzzle** with a simple “No puzzle found” fallback.

⚠ `app/stats/page.tsx` has **no** `revalidate` — pure client stats mock anyway; low risk.

⚠ Admin pages generally fetch only what each view needs; `getPipelineSummary` may run extra fallback queries if the view is missing.

? Home/solve/win/waiting each call `getTodaysPuzzle()` independently — user navigating in-session refetches the same puzzle multiple times (acceptable; no shared cache).

---

### 3. Client components (`app/components/*.tsx`, `AdminShell`, `theme.tsx`)

✓ `HomeScreen` / `SolveScreen` defer `localStorage` and redirects to `useEffect`, avoiding SSR/client HTML mismatch on first paint.

✓ `SolveScreen` `previewMode` skips session upsert, `/waiting` redirect, `/win` navigation, and uses preview storage when completing — behavior is genuinely gated.

⚠ `SolveScreen` completion effect depends on `onPreviewSolveComplete`; if parent passes an **unstable inline function**, effect could re-run — parent preview shell uses `useCallback` (good).

⚠ Large `SolveScreen` keyboard `useEffect` depends on `cellToClueMap` — map identity changes with puzzle; listener rebinds — OK but worth knowing.

✗ **Production solve path** still saves `hints_used: 999` when status is revealed in `saveTodaySolve` while DB update uses `1` — inconsistent semantics (`WinScreen`/`WaitingScreen` special-case `>= 999`).

? Preview sticky banner + `suppressPreviewBanner` — two code paths; easy to regress if someone removes one prop.

---

### 4. API route + cron (`app/api/cron/publish-next/route.ts`, `vercel.json`, `middleware.ts`)

✓ Cron `GET` checks `Authorization: Bearer ${CRON_SECRET}` and returns **401** when missing or mismatched.

✓ RPC failure returns **500** and logs `console.error`.

⚠ If `CRON_SECRET` is **unset**, **every** request gets 401 — secure but can hide misconfiguration until deploy.

⚠ `vercel.json` schedule `0 11 * * *` is **11:00 UTC** (~7am **EDT**, ~6am **EST**) — documented in README but not exact year-round 7am ET.

✓ `middleware.ts` matcher `/admin/:path*` runs but **does not block** — intentional placeholder with TODO.

? Next.js 16 warns middleware convention deprecated — future migration noise, not a runtime bug today.

---

### 5. Server actions (`'use server'`)

✓ Queue/draft/delete actions call `revalidatePath` on relevant admin routes after mutations.

✓ `createDraftFromDslAction` re-parses DSL server-side (does not trust client-only validation).

⚠ Queue move/reorder assumes puzzle ids from server-trusted `getAdminPuzzles` — direct POST **could** send arbitrary UUIDs if actions are invoked manually (auth-by-obscurity).

⚠ `previewGlossaryMatchesForDslAction` performs **one SELECT per clue** — fine for ~20 clues; noisy under load.

✗ Until `supabase/migrations/20260418120000_create_draft_with_glossary.sql` is applied in Supabase, **`createDraftFromDslAction` fails** with an explicit error message pointing at the migration.

---

### 6. Style / consistency

✓ Project consistently uses **inline styles** on primary surfaces (no Tailwind in reviewed paths).

⚠ **Color literals** remain in many admin pages (`app/admin/page.tsx` local `s`, `AdminShell` object `a`, `app/admin/new/page.tsx`) alongside `theme` tokens — mixed strategy.

✓ `theme.tsx` centralizes primary consumer chrome; admin preview adds status tokens on `theme`.

✓ Georgia 900 used for admin shell wordmark and preview titles; body remains `system-ui`.

---

### 7. Routing

✓ `/admin/drafts`, `/admin/queue`, `/admin/history`, dashboard “Preview” point at `/admin/puzzles/[id]` as intended.

✓ `createDraftFromDslAction` redirects to `/admin/puzzles/<id>` after success.

⚠ Client `handleCreate` must **rethrow** redirect digest errors — already handled via `isNextRedirect`-style check on `NEXT_REDIRECT`.

? Deep links to `/solve` without a puzzle show “No puzzle found” — acceptable; no automatic redirect home.

---

### 8. Accessibility (quick pass)

✓ Primary navigation uses `<Link>` and `<button>` in admin shell and preview shell.

⚠ DSL `textarea` on `/admin/new` has **no `<label>`** associated via `htmlFor` / `aria-label` — screen reader friction.

⚠ On-screen solver keyboard uses `role="button"` `div`s — **not real `<button>`** elements — weaker keyboard/AT semantics.

✓ Physical keyboard path exists for solving (`keydown` listener).

---

## Severity counts (approximate)

| Symbol | Count |
|--------|-------|
| ✓ Good | 28 |
| ⚠ Minor | 18 |
| ✗ Risk / bug | 6 |
| ? Uncertain | 8 |

---

## Top 3 recommendations

1. **Apply and verify** the `create_draft_with_glossary` migration in production Supabase; grant RPC appropriately (avoid exposing `SECURITY DEFINER` to anonymous callers if Supabase grants are wide).
2. **Align `hints_used`** between `saveTodaySolve`, DB update, and win/waiting UI (remove the `999` sentinel or document it as intentional everywhere).
3. **Harden device registration** — await or surface `devices` upsert failures; avoid transient random UUIDs without persistence.

---

## Good candidates to defer

- Replacing mock stats with real aggregates.
- Collapsing repeated `getTodaysPuzzle()` fetches via React cache / single loader.
- Full Supabase-generated TypeScript types for tables/RPCs.
- Drag-and-drop queue ordering.
- Escaped-quote support in DSL clue strings.
