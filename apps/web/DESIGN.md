# Web Design System (`apps/web`)

Conventions every change in this app must follow so the UI stays consistent. Written for
both human contributors and coding agents. **This describes what the app already does —
match it, don't reinvent it.** When code and this document disagree, the code wins; update
this file in the same change.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript.
- Tailwind CSS v3 with CSS-variable theming (`tailwind.config.ts`, `app/globals.css`).
- Hand-written shadcn-style primitives in `components/ui/` (new-york flavor). **No Radix** —
  kept out deliberately to minimize deps; use native elements styled with tokens instead.
- Geist Sans / Geist Mono via the `geist` package; icons from `lucide-react`.
- Lint/format: the repo's `oxlint` + `oxfmt`. **No eslint, no `create-next-app` configs.**

## Route map

Two distinct surfaces share this app:

| Route                                                                | Access | Purpose                                                   |
| -------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| `/`                                                                  | public | Marketing landing page (`components/landing/`)            |
| `/demo`                                                              | public | Interactive live matchmaking demo (`demo-board.tsx`)      |
| `/login`, `/register`                                                | public | Auth screens (redirect to `/dashboard` if signed in)      |
| `/dashboard`                                                         | gated  | User's organizations + create-org form                    |
| `/dashboard/organizations/[orgId]`                                   | gated  | Org's projects (+ create) and members                     |
| `/dashboard/projects/[projectId]`                                    | gated  | Project overview: environments, API keys, webhooks        |
| `/dashboard/projects/[projectId]/{pools,matches,deliveries,ratings}` | gated  | Operational views via project sub-nav (`project-nav.tsx`) |

`middleware.ts` enforces this: no session cookie + `/dashboard/**` → redirect to `/login`;
session cookie + auth page → redirect to `/dashboard`. Everything else is public.

Navigation is tenant-shaped — **Organization → Project → resource** — and every project
page links back to its organization.

## Theme tokens

Both light and dark are supported (zinc base), and **dark is the default**. A blocking inline
script in the root layout applies the saved theme (or dark) before first paint — no FOUC — by
toggling `.dark` on `<html>`; `components/theme-toggle.tsx` flips it and persists to
`localStorage` (`theme`). It lives in the landing and dashboard headers. Colors are HSL CSS
variables in `app/globals.css` (`:root` = light, `.dark` = dark) exposed through Tailwind.
**Always build from tokens so both themes work; never hard-code hex or use ad-hoc Tailwind
palette classes for foundational surfaces.** (The only raw color is the drawer scrim
`bg-black/60`, which is correct over content in either theme.)

- Surfaces: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `ring-ring`, `bg-input`.
- Intent: `primary`, `secondary`, `muted`, `accent`, `destructive`, plus app colors
  `success` and `warning` (each with a `-foreground`).
- Radius: `--radius: 0.5rem` → `rounded-lg/md/sm`.
- Fonts: `font-sans` (Geist) for UI text; `font-mono` (Geist Mono) for IDs, slugs, API keys,
  URLs, timestamps, and code.

## Component primitives (`components/ui/`)

Pattern for every primitive: `React.forwardRef`, `cn()` for class merge, `cva` for variants.
Sizing is via Tailwind classes, not variant props (icons `size-4` / `size-3`).

| Primitive                     | Notes                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button`                      | Variants `default \| destructive \| outline \| secondary \| ghost \| link`; sizes `default \| sm \| lg \| icon`                                                                   |
| `badge`                       | Variants `default \| secondary \| destructive \| success \| warning \| outline`                                                                                                   |
| `card`                        | Compound: `Card / CardHeader / CardTitle / CardDescription / CardContent`                                                                                                         |
| `table`                       | Compound table parts                                                                                                                                                              |
| `input`, `label`, `separator` | Form and layout basics                                                                                                                                                            |
| `spinner`                     | `cva`-sized `Loader2`, `text-muted-foreground`                                                                                                                                    |
| `toast`                       | Dependency-free pub/sub toaster; call `toast(...)` from any client component; a single `<Toaster />` is mounted in the root layout                                                |
| `skeleton`                    | `animate-pulse` placeholder block; compose with sizing classes (`<Skeleton className="h-4 w-32" />`) inside `loading.tsx` files                                                   |
| `empty-state`                 | `EmptyState` — icon + title + description + optional action link, for lists with zero items                                                                                       |
| `error-display`               | `ErrorDisplay` (title + message + optional retry/back) and `parseError(error)` — used inside `error.tsx` boundaries                                                               |
| `not-found`                   | `NotFoundView` — icon + title + description + back link, for `notFound()` / `not-found.tsx` pages                                                                                 |
| `avatar`                      | `Avatar` circle (initials fallback via `initialsFrom`) — account affordance in the header                                                                                         |
| `dropdown-menu`               | Hand-rolled `DropdownMenu` (+ `DropdownItem/Label/Separator`); outside-click + Escape to close. No Radix. Used by `UserMenu`                                                      |
| `drawer`                      | Hand-rolled off-canvas `Drawer` (backdrop, slide, Escape + body-scroll lock, `md:hidden`) for mobile navigation                                                                   |
| `copy-button`                 | `CopyButton` — clipboard icon button for mono values (project/match IDs, keys, webhook URLs); shows a check for ~1.5s                                                             |
| `confirm-button`              | `ConfirmButton` — inline two-step confirm for destructive form submits (arms → destructive `type="submit"` + Cancel); spinner via `useFormStatus` while the action runs. No modal |
| `password-input`              | `PasswordInput` — `<Input>` with a show/hide toggle + Caps Lock warning; forwards ref/props so it drops into forms                                                                |
| `password-strength`           | `PasswordStrength` — advisory 4-bar meter + label from a simple heuristic (register only); API still enforces the real rules                                                      |

Domain helpers on top of primitives: `status-badge.tsx` maps a domain status to a badge
variant (`StatusBadge`); `pagination.tsx` for list paging.

Adding a primitive: copy the shadcn source shape, theme it with tokens only, drop it in
`components/ui/`. Don't pull in a component library.

## Architecture patterns

### Auth & data fetching

- The session token lives in an httpOnly cookie (`dashboard_token`); `middleware.ts` gates
  `/dashboard/**` as described in the route map.
- **Reads**: Server Components call `apiFetch<T>(path)` from `lib/api.ts`. It runs server-side,
  attaches the cookie token as a Bearer header, and uses `cache: "no-store"`. The token never
  reaches the browser, and the browser never calls the API host directly.
- Page props `params` and `searchParams` are Promises in Next 15 — `await` them.

#### Live reads: SSR-first + SWR revalidation

Operational list views that change over time (pools, matches, deliveries, ratings) stay
fresh without a manual refresh, while keeping the token server-side:

- The **Server Component page** still does the first fetch with `apiFetch` (fast first
  paint, SSR, errors flow into `error.tsx`) and passes the result to a client
  `*-table.tsx` component as `fallback`.
- The client table calls `useSWR(key, { fallbackData: fallback, refreshInterval })`. SWR
  shows the SSR data instantly, then revalidates on an interval / focus / reconnect —
  stale-while-revalidate, no spinner flash. `SwrProvider` (mounted in the root layout)
  sets the global fetcher (`jsonFetcher`) and defaults (`keepPreviousData`, dedupe).
- The SWR `key` is a **same-origin proxy route handler** under
  `app/api/projects/[projectId]/{pools,matches,deliveries,ratings}/route.ts`. Each is a
  thin `proxyGet()` wrapper (`lib/proxy.ts`) that runs the same server-side `apiFetch`
  and maps `ApiError`/network failures onto HTTP statuses. So the browser only ever
  fetches our own routes — never the API host, never the token — the same rule the
  `/api/demo/*` and `/api/session/*` handlers already follow.

Config surfaces that only change on an explicit mutation (org/project overview) stay
plain Server Components + `revalidatePath` — don't add SWR there.

**Snappy tab navigation.** The project sub-nav (`project-nav.tsx`) sets `prefetch` on each
tab `<Link>` so a tab's data is fetched before it's clicked, and `next.config.mjs` sets
`experimental.staleTimes.dynamic` so an already-visited tab's RSC payload is reused from the
client Router Cache instead of re-hitting the API on every switch. (Both are production
behaviours — `next dev` disables prefetch and recompiles routes on first hit, so tab
switching always feels slower in dev.)

### Mutations — always Next Server Actions

Defined in `lib/actions.ts` (`"use server"`). Never POST to the API from the client directly.

- Forms that show validation/return state use `useActionState(action, initial)` in a client
  component; the action returns `{ error?: string }` (or a richer state like the API key's
  one-time `key`).
- Fire-and-forget actions (revoke / delete / toggle) are plain `(formData) => Promise<void>`
  used as `<form action={fn}>` with hidden inputs for ids.
- After a write: `revalidatePath(...)`; `redirect(...)` on create.
- Surface API failures through `humanize(error)` (maps `ApiError` status → friendly text).

### Interactive lists = "manager" components

A Server Component fetches the data and passes it to a client `*-manager.tsx` component
(`api-keys-manager`, `webhooks-manager`, `environments-manager`, `members-manager`) that
renders the list plus its create/edit forms wired to server actions.

### Role-gated UI

Read the caller's role from `getCurrentUser()` (`/auth/me`) and hide management controls when
the user lacks the role (e.g. `canManage = role === "OWNER" || role === "ADMIN"`). This is UX
only — the API enforces authorization regardless.

### Loading, error & not-found states

Every route segment under `app/` handles the slow/broken/missing cases with Next.js
conventions instead of letting the framework's generic crash screen show:

- `loading.tsx` — a route-shaped skeleton built from `<Skeleton>` (and `Table`/`Card`
  skeleton rows for list pages) shown instantly while the segment's Server Component
  data-fetches are in flight. Since `loading.tsx` wraps the whole segment (its
  `layout.tsx` **and** `page.tsx`), it needs to mimic the full chrome that segment
  renders, not just the page content.
- `error.tsx` — a client component error boundary rendering `<ErrorDisplay
message={parseError(error)} retry={reset} backHref="..." />`. `parseError` turns an
  `ApiError` / `NetworkError` / `TimeoutError` / generic `Error` into a human sentence.
  Keep these files thin — no business logic, just the boundary UI.
- `not-found.tsx` + `notFound()` — Server Components that fetch a resource by id
  (`organizations/[orgId]`, `projects/[projectId]`) catch a 404 `ApiError` and call
  `notFound()` instead of letting the fetch throw into `error.tsx`. Pair each with a
  `not-found.tsx` using `<NotFoundView>` scoped to that segment.
- `lib/api.ts`'s `apiFetch` throws `NetworkError` (fetch/`TypeError`) or `TimeoutError`
  (`AbortError`) instead of letting those escape as opaque errors — both are handled by
  `parseError` and by `humanize()` in `lib/actions.ts` for form-action failures.

### Auth-aware public header

`components/landing/site-header.tsx` is a client component used on `/` (and reusable
elsewhere) that checks `GET /api/session/me` on mount — a route handler that reads the
`dashboard_token` cookie server-side and calls `getCurrentUser()`, never exposing the
token to the browser. It renders a `Skeleton` avatar-sized pill while checking, then either
the anonymous CTAs (Demo / Sign in / Start free) or the shared `UserMenu` (avatar dropdown) —
identical to the dashboard header — so the signed-in state stays compact on mobile.

### Auth screens

`/login` and `/register` share `components/auth/auth-shell.tsx`: a split-screen with a brand
panel on the left (grid + gradient, tagline, feature bullets) shown only on `lg+`, and the
form on the right with a "Back to home" link and the `ThemeToggle`. Below `lg` the panel is
hidden and just the form shows. Password fields use `PasswordInput` (show/hide + Caps Lock),
and register adds a `PasswordStrength` meter under the password.

### Mobile & responsive navigation

Best practices this dashboard follows (Material navigation-drawer / top-app-bar patterns,
Apple HIG, common SaaS-console conventions), tuned for a tenant-shaped hierarchy
(Org → Project → resource). **`md` (768px) is the mobile/desktop divide.**

- **Top app bar** (`app/dashboard/layout.tsx`): a sticky bar with — on mobile — a hamburger
  (opens the drawer) + brand on the left and an **avatar menu** on the right; on desktop the
  hamburger is hidden (`md:hidden`) since the inline tabs/cards already expose navigation.
  This is _responsive disclosure_: one nav model, revealed differently per breakpoint. Don't
  build a second, parallel desktop sidebar — desktop keeps the centered-content + tabs layout.
- **Account = avatar menu** (`components/user-menu.tsx`): the email/sign-out controls live in
  a `DropdownMenu` behind an `Avatar`, not spread across the bar. Menu holds name + email,
  a Dashboard link, and Sign out. Same component across breakpoints — and the **landing
  header reuses the exact same `UserMenu`** for its signed-in state, so a wide email never
  overflows the bar on mobile.
- **Navigation drawer** (`components/dashboard-mobile-nav.tsx`, mobile only): an off-canvas
  `Drawer` opened from the hamburger. Its links are **context-aware** — derived from
  `usePathname()` — so inside a project it lists that project's sections vertically (easy
  tap targets), plus the always-present "Organizations" home and public links. It closes on
  navigation, backdrop tap, and Escape.
- **Sub-pages stay tabs** (`components/project-nav.tsx`): the project resource nav is a tab
  row on every breakpoint, made **horizontally scrollable** (`overflow-x-auto`, no wrap) on
  mobile so five tabs never wrap or clip. The drawer offers the same destinations as a
  vertical fallback.
- **Tables** already wrap in an `overflow-auto` container (`ui/table`), so wide rows scroll
  within the card instead of breaking the page on narrow screens.

### No Radix → native, styled

Use a native `<select>` styled with token classes for dropdowns. Prefer dedicated pages or
inline forms over content modals; there is no Dialog primitive. **Navigation overlays are the
exception**: the `Drawer` (mobile nav) and `DropdownMenu` (account menu) are allowed, built
hand-rolled from native elements + tokens (outside-click / Escape / backdrop, no Radix) — they
carry navigation, not forms.

### Landing & demo (public surface)

- Landing sections live in `components/landing/` (`hero-matchmaking`, `code-window`, `faq`,
  `reveal` for scroll animation). They follow the same tokens and primitives as the dashboard.
- On mobile the header drops the redundant "Demo" link, and `mobile-cta-bar.tsx` pins a
  "Demo / Start free" bar to the bottom for logged-out visitors (hidden on `sm+` and once
  authenticated) — a page-end spacer keeps it from covering the footer.
- The `/demo` page drives `demo-board.tsx` against server-side plumbing in `lib/demo.ts`; the
  demo API key stays server-side like every other credential.

## Do / Don't

**Do**

- Reuse `ui/` primitives and theme tokens only.
- Use `font-mono` for identifiers (IDs, keys, slugs, timestamps).
- Route every mutation through a server action.
- Give empty and error states a real treatment, not a blank space.
- Update this document when a pattern changes.

**Don't**

- Add Radix, eslint, or any component library.
- Use ad-hoc hex or Tailwind palette colors for surfaces.
- Call the API host directly from the browser, or expose any token to the browser. Client
  reads go through a same-origin `/api/*` route handler (SWR); mutations go through server
  actions.
- Nest cards inside cards.
- Add content/form modals — prefer dedicated pages or inline forms. (Navigation overlays —
  `Drawer`, `DropdownMenu` — are allowed; see Mobile & responsive navigation.)

## Build gotcha

If `next build` fails with a middleware `EvalError` or a `/_not-found` build-trace error
(transient on Windows), delete `apps/web/.next` and rebuild.
