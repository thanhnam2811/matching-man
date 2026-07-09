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

Dark mode is the default (`<html class="dark">`). Colors are HSL CSS variables defined in
`app/globals.css` (zinc base) and exposed through Tailwind. **Always build from tokens; never
hard-code hex or use ad-hoc Tailwind palette classes for foundational surfaces.**

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

| Primitive                     | Notes                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `button`                      | Variants `default \| destructive \| outline \| secondary \| ghost \| link`; sizes `default \| sm \| lg \| icon`                    |
| `badge`                       | Variants `default \| secondary \| destructive \| success \| warning \| outline`                                                    |
| `card`                        | Compound: `Card / CardHeader / CardTitle / CardDescription / CardContent`                                                          |
| `table`                       | Compound table parts                                                                                                               |
| `input`, `label`, `separator` | Form and layout basics                                                                                                             |
| `spinner`                     | `cva`-sized `Loader2`, `text-muted-foreground`                                                                                     |
| `toast`                       | Dependency-free pub/sub toaster; call `toast(...)` from any client component; a single `<Toaster />` is mounted in the root layout |
| `skeleton`                    | `animate-pulse` placeholder block; compose with sizing classes (`<Skeleton className="h-4 w-32" />`) inside `loading.tsx` files    |
| `empty-state`                 | `EmptyState` — icon + title + description + optional action link, for lists with zero items                                        |
| `error-display`               | `ErrorDisplay` (title + message + optional retry/back) and `parseError(error)` — used inside `error.tsx` boundaries                |
| `not-found`                   | `NotFoundView` — icon + title + description + back link, for `notFound()` / `not-found.tsx` pages                                  |

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
  reaches the browser; there are no client-side `fetch`es to the API.
- Page props `params` and `searchParams` are Promises in Next 15 — `await` them.

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
token to the browser. It renders a `Skeleton` pill while checking, then either the
anonymous CTAs (Demo / Sign in / Start free) or a signed-in profile pill (email +
Dashboard link + `LogoutButton`).

### No Radix → native, styled

Use a native `<select>` styled with token classes for dropdowns. Prefer dedicated pages or
inline forms over modals; there is no Dialog primitive.

### Landing & demo (public surface)

- Landing sections live in `components/landing/` (`hero-matchmaking`, `code-window`, `faq`,
  `reveal` for scroll animation). They follow the same tokens and primitives as the dashboard.
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
- Fetch the API from the client or expose any token to the browser.
- Nest cards inside cards.
- Add modals — prefer dedicated pages or inline forms.

## Build gotcha

If `next build` fails with a middleware `EvalError` or a `/_not-found` build-trace error
(transient on Windows), delete `apps/web/.next` and rebuild.
