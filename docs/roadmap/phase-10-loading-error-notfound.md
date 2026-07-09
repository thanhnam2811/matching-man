# Phase 10: Design System — Loading, Error, Not Found & Demo UX

## Status

- [x] Done

## Goal

Systematically handle **loading (slow network)**, **API error**, and **not found** states across the ENTIRE app (dashboard + landing + demo) _before_ any happy-path polish, and improve the **public landing & demo UX** for logged-in users and live demo interaction.

### Current gaps

1. **Every dashboard page** crashes into a generic Next.js error page when the API is slow, returns an error, or returns 404.
2. **The landing page** always shows "Sign in" / "Start free" even when the user is already logged in — no profile menu.
3. **The demo page** has no loading skeletons on initial load, no error boundary, and the UX for adding + matching players is clunky (two add buttons, matched players disappear instantly).

## Strategy

Use Next.js built-in conventions (`loading.tsx`, `error.tsx`, `not-found.tsx`) + a small set of reusable UI components. No new dependencies — everything is built from existing primitives (Card, Button, Spinner, Badge, CSS animation tokens).

---

## Section A — Dashboard: Loading, Error & Not Found

### A1. Reusable Components (`components/ui/`)

| Component      | File                              | Purpose                                                                                                                 |
| -------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Skeleton`     | `components/ui/skeleton.tsx`      | Pulse-animated placeholder blocks for loading content                                                                   |
| `EmptyState`   | `components/ui/empty-state.tsx`   | Consistent empty-slate UI (icon + heading + description + optional action)                                              |
| `ErrorDisplay` | `components/ui/error-display.tsx` | Error card with message + retry/back link for `error.tsx` boundaries. Also exports `parseError(error: unknown): string` |
| —              | `components/ui/not-found.tsx`     | Shared 404 view (no layout chrome) for page-level `notFound()` calls                                                    |

**`skeleton.tsx`** — minimal shimmer:

```tsx
// Animate-pulse block. Variants: text, card, table-row.
// Usage: <Skeleton className="h-4 w-3/4" /> inside a loading.tsx or inline.
// Uses bg-muted with animate-pulse from Tailwind.
```

**`empty-state.tsx`** — domain-agnostic empty placeholder (replaces inline "No X yet." across pages):

```tsx
// Props: icon?, title, description?, action? (label + href)
// Themed with text-muted-foreground, respects existing card patterns.
```

**`error-display.tsx`** — self-contained error boundary UI:

```tsx
// Props: title?, message, retry?: () => void, backHref?: string
// Shows destructive border, error icon, description, optional retry button + back link.
// `parseError(error)`: extracts human-readable message from ApiError, network errors, plain Errors.
```

### A2. `loading.tsx` — Every Route Segment

Create `loading.tsx` at each level with matching skeletons:

| File                                                        | Skeleton pattern                                |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `app/dashboard/loading.tsx`                                 | Card grid skeleton (3 cards) — for org list     |
| `app/dashboard/organizations/[orgId]/loading.tsx`           | Title + 2 card skeletons + member list skeleton |
| `app/dashboard/projects/[projectId]/loading.tsx`            | Title + nav tabs skeleton + 2-column card grid  |
| `app/dashboard/projects/[projectId]/pools/loading.tsx`      | Table skeleton (5 rows × 5 cols)                |
| `app/dashboard/projects/[projectId]/matches/loading.tsx`    | Table skeleton + pagination skeleton            |
| `app/dashboard/projects/[projectId]/deliveries/loading.tsx` | Table skeleton + pagination skeleton            |
| `app/dashboard/projects/[projectId]/ratings/loading.tsx`    | Table skeleton + pagination skeleton            |
| `app/login/loading.tsx`                                     | Card skeleton matching login form dimensions    |
| `app/register/loading.tsx`                                  | Card skeleton matching register form dimensions |

Each `loading.tsx` uses the same layout wrapper class (e.g. `mx-auto max-w-5xl space-y-6`) so the transition is seamless.

### A3. `error.tsx` — Error Boundaries

| File                                                      | Behavior                                          |
| --------------------------------------------------------- | ------------------------------------------------- |
| `app/dashboard/error.tsx`                                 | "Something went wrong" + "Back to dashboard" link |
| `app/dashboard/organizations/[orgId]/error.tsx`           | Error message + "Back to organizations" + retry   |
| `app/dashboard/projects/[projectId]/error.tsx`            | Error message + "Back to organization" + retry    |
| `app/dashboard/projects/[projectId]/pools/error.tsx`      | Inline "Failed to load pools" + retry             |
| `app/dashboard/projects/[projectId]/matches/error.tsx`    | Inline "Failed to load matches" + retry           |
| `app/dashboard/projects/[projectId]/deliveries/error.tsx` | Inline "Failed to load deliveries" + retry        |
| `app/dashboard/projects/[projectId]/ratings/error.tsx`    | Inline "Failed to load ratings" + retry           |
| `app/login/error.tsx`                                     | "Failed to load sign in page" + retry             |
| `app/register/error.tsx`                                  | "Failed to load sign up page" + retry             |

### A4. `not-found.tsx` — Custom 404 Pages

| File                                                | Behavior                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `app/not-found.tsx`                                 | Global 404 — "Page not found" + link to home                          |
| `app/dashboard/not-found.tsx`                       | Dashboard 404 — wrapped in dashboard layout                           |
| `app/dashboard/organizations/[orgId]/not-found.tsx` | "Organization not found" + possible reasons + "Back to organizations" |
| `app/dashboard/projects/[projectId]/not-found.tsx`  | "Project not found" + "Back to organization"                          |

### A5. Server Components: `notFound()` Calls

Add explicit `notFound()` calls where the API returns 404, instead of letting the page crash:

- `app/dashboard/organizations/[orgId]/page.tsx` — catch `ApiError(404)` → `notFound()`
- `app/dashboard/projects/[projectId]/layout.tsx` — catch `ApiError(404)` → `notFound()`
- `app/dashboard/projects/[projectId]/page.tsx` — catch `ApiError(404)` → `notFound()`

### A6. Update `lib/actions.ts` — Better `humanize()`

| Error case                   | Current                | New                                                                |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------ |
| Network error (fetch throws) | "Something went wrong" | "Unable to reach the server. Check your connection and try again." |
| Timeout                      | "Something went wrong" | "The server did not respond in time. Please try again."            |
| 500+                         | "Something went wrong" | "The server encountered an error (500). Please try again later."   |
| 404                          | "Something went wrong" | "The requested resource was not found."                            |
| 429                          | "Something went wrong" | "Too many requests — please slow down and try again."              |

### A7. Update `lib/api.ts` — Network Error Clarity

Wrap the `fetch` call in `apiFetch` to distinguish network errors from HTTP errors:

```ts
// Detect: fetch throws TypeError → network error
// Detect: AbortError → timeout
// Keep: HTTP non-ok → ApiError (existing)
```

### A8. Global Error UI

| File            | Behavior                                                            |
| --------------- | ------------------------------------------------------------------- |
| `app/error.tsx` | Global error boundary — minimal branded error page with "Try again" |

---

## Section B — Landing Page: Auth-Aware Header

### B1. `components/landing/site-header.tsx` — New Client Component

Extract the landing page `<header>` into a client component that detects auth state:

- On mount, calls `GET /api/session/me` (new lightweight endpoint that returns `{ authenticated: boolean, email?: string }`).
- **Not authenticated**: renders current buttons: Demo / Sign in / Start free.
- **Authenticated**: replaces buttons with a profile pill showing:
    - User email (truncated) or name
    - Quick links: Dashboard, Sign out (using existing `LogoutButton`)
- The component uses a brief loading state (shown as a single muted `Skeleton` pill) while checking auth.

### B2. `app/api/session/me/route.ts` — New Endpoint

Lightweight endpoint that reads the `dashboard_token` cookie and returns:

```json
{ "authenticated": true, "email": "user@example.com" }
// or
{ "authenticated": false }
```

This is called by the landing page header. It validates the token by calling `/auth/me` on the API, or simply checks for the cookie's existence + `fetch` to `/auth/me` with caching.

### B3. Modify `app/page.tsx`

Replace the inline `<header>` with the new `SiteHeader` component. The header markup stays identical — only the auth-aware controls change.

---

## Section C — Demo Page: Loading, Error & UX Improvements

### C1. `app/demo/loading.tsx`

Demo page skeleton — shows the same layout shell (title + back link + description) with placeholder card skeletons for the controls area and the queue/matches grid.

### C2. `app/demo/error.tsx`

Demo page error boundary — "Failed to load demo" + "Back to home" + retry. Catches crashes from server-side helpers or unexpected render errors.

### C3. Modify `components/demo-board.tsx` — UX Overhaul

**Problem 1 — Two buttons for adding players**:
Currently there are two separate buttons: "Add player" (uses the manual rating input) and "Add random" (generates a random rating). This is confusing because:

- User must choose between two buttons
- Most users either type a specific rating or want a quick random one

**Fix — One input with inline shuffle + one "Add player" button**:

- Keep the rating `<Input>` so users can type a custom Elo if they want.
- Add a **shuffle button** (`Shuffle` icon) **inside the input** (as a right adornment) that randomizes the rating value to 800–2200. Clicking it fills the input with a random number.
- Keep **one single "Add player" button** that always uses whatever rating is currently in the input.
- The mode description stays unchanged.

**Problem 2 — Matched players disappear instantly**:
When a match forms, the two players vanish from the queue list abruptly. This feels broken.

**Fix — Exit animation with "Matched!" state**:
When `pollForMatch` discovers a match:

1. The matched queue entries get a `matched` state instead of being removed immediately.
2. They stay in the queue list for **2 seconds** with a visual transition:
    - Background briefly flashes with `bg-success/10` + success border
    - A "Matched!" badge appears next to each matched player
    - A subtle scale + fade-out animation removes them after 2s
3. The match card slides into the Matches column with a fade-in animation (`animate-fade-in` from existing tailwind config).

**Implementation**:

- Add transient state: `matchedQueueEntryIds: Set<string>` — set of ids being animated out.
- When poll discovers a match, add matched player ids to this set + start a 2s timer to remove them.
- In the queue list render, items in the matched set get extra styling.
- The Matches column uses `animate-fade-in` on new match cards.

**Problem 3 — No visual feedback during slow operations**:

- "Add player" already has `loading={pending}`, but the button could be more descriptive.
- When the server is cold-starting, show a clearer progress indicator.

**Fix**:

- The `ServerBanner` stays but gets a more prominent spinner + elapsed time.
- When `addPlayer` is in flight, the button text becomes "Adding…" (already works via `loading` prop).

---

## Non-Goals (out of scope)

- **Client-side loading spinners for mutations**: Already handled by Button `loading` prop + `useActionState pending`
- **Optimistic updates for dashboard mutations**: Too complex for this phase
- **Full i18n**: All error strings stay hard-coded in English
- **Dialog/modal error patterns**: No new Dialog primitives per DESIGN.md rules
- **Suspense streaming/partial rendering**: Use simple `loading.tsx` files, no manual `Suspense` boundaries unless needed

## Edge Cases Covered

| Scenario                            | Handling                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| API returns 404 for org/project     | `notFound()` → renders not-found.tsx with "Organization not found" + possible reasons |
| API is down (connection refused)    | `error.tsx` → renders ErrorDisplay with "Unable to reach the server" + retry button   |
| API returns 500                     | `error.tsx` → renders ErrorDisplay with "500" message + retry                         |
| API is slow (>5s response)          | `loading.tsx` shows skeleton immediately instead of blank white page                  |
| Network drops mid-page-navigation   | `error.tsx` catches the thrown TypeError → renders retry UI                           |
| User bookmarks a deleted org        | `notFound()` in Server Component → not-found.tsx                                      |
| User manually types wrong URL       | Next.js global 404 → `app/not-found.tsx`                                              |
| Rate limited (429)                  | `humanize()` returns clear message in form errors                                     |
| Slow initial page load (cold start) | Every route has skeleton loading.tsx so user sees progressive content                 |
| User visits landing while logged in | Header shows profile menu instead of Sign in / Start free                             |
| Demo cold-start                     | ServerBanner with spinner + descriptive text                                          |
| Demo match discovered               | Queue item animates "Matched!" badge → fades out over 2s                              |
| Demo API call fails                 | Toast with error + queue entry cleaned up                                             |

## Files Changed (Summary)

```
=== Section A — Dashboard ===
CREATE  components/ui/skeleton.tsx
CREATE  components/ui/empty-state.tsx
CREATE  components/ui/error-display.tsx
CREATE  app/error.tsx                              (global error boundary)
CREATE  app/not-found.tsx                          (global 404)
CREATE  app/dashboard/loading.tsx
CREATE  app/dashboard/error.tsx
CREATE  app/dashboard/not-found.tsx
CREATE  app/dashboard/organizations/[orgId]/loading.tsx
CREATE  app/dashboard/organizations/[orgId]/error.tsx
CREATE  app/dashboard/organizations/[orgId]/not-found.tsx
CREATE  app/dashboard/projects/[projectId]/loading.tsx
CREATE  app/dashboard/projects/[projectId]/error.tsx
CREATE  app/dashboard/projects/[projectId]/not-found.tsx
CREATE  app/dashboard/projects/[projectId]/pools/loading.tsx
CREATE  app/dashboard/projects/[projectId]/pools/error.tsx
CREATE  app/dashboard/projects/[projectId]/matches/loading.tsx
CREATE  app/dashboard/projects/[projectId]/matches/error.tsx
CREATE  app/dashboard/projects/[projectId]/deliveries/loading.tsx
CREATE  app/dashboard/projects/[projectId]/deliveries/error.tsx
CREATE  app/dashboard/projects/[projectId]/ratings/loading.tsx
CREATE  app/dashboard/projects/[projectId]/ratings/error.tsx
CREATE  app/login/loading.tsx
CREATE  app/login/error.tsx
CREATE  app/register/loading.tsx
CREATE  app/register/error.tsx
MODIFY  lib/api.ts                                  (network error detection)
MODIFY  lib/actions.ts                              (better humanize)
MODIFY  app/dashboard/organizations/[orgId]/page.tsx (add notFound())
MODIFY  app/dashboard/projects/[projectId]/layout.tsx (add notFound())
MODIFY  app/dashboard/projects/[projectId]/page.tsx  (add notFound())

=== Section B — Landing Auth Header ===
CREATE  app/api/session/me/route.ts                 (lightweight auth check)
CREATE  components/landing/site-header.tsx           (auth-aware header)
MODIFY  app/page.tsx                                 (replace inline header)

=== Section C — Demo UX ===
CREATE  app/demo/loading.tsx
CREATE  app/demo/error.tsx
MODIFY  components/demo-board.tsx                    (single button, match exit anim)
MODIFY  app/demo/page.tsx                            (add demo loading/error context)

=== Meta ===
MODIFY  DESIGN.md                                    (document new patterns)
```

## Migration Path

1. **Core primitives**: `Skeleton`, `EmptyState`, `ErrorDisplay`
2. **Infra**: `lib/api.ts` + `lib/actions.ts` improvements
3. **Global boundaries**: `app/not-found.tsx` + `app/error.tsx`
4. **Dashboard routes**: layout-level → sub-route loading/error/not-found files
5. **Wire `notFound()`** into server components
6. **Landing auth-aware header**: `site-header.tsx` + `app/api/session/me` + swap into `page.tsx`
7. **Demo UX**: loading/error files → demo-board.tsx overhaul (single button + match animation)
8. **Update `DESIGN.md`**

## Validation

- `pnpm --dir apps/web build` — must succeed
- `pnpm --dir apps/web typecheck` — must succeed
- Each loading.tsx renders in place of content when API is slow
- Each error.tsx catches and shows friendly error + retry
- Each not-found.tsx shows for known 404 scenarios
- Landing page header shows profile menu when `dashboard_token` cookie exists
- Demo single "Add player" button adds players with random rating
- Matched players show "Matched!" badge → fade out over 2s instead of disappearing instantly
