# Web Design System (`apps/web`)

The conventions every change in the admin dashboard must follow so the UI stays
consistent. This describes what the app already does — match it, don't reinvent it.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript.
- Tailwind CSS v3 with CSS-variable theming (`tailwind.config.ts`, `app/globals.css`).
- Hand-written shadcn-style primitives in `components/ui/` (new-york flavor). **No Radix** —
  kept out deliberately to minimize deps; use native elements styled with tokens instead.
- Geist Sans / Geist Mono via the `geist` package; icons from `lucide-react`.
- Lint/format: the repo's `oxlint` + `oxfmt`. **No eslint, no `create-next-app` configs.**

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

`button`, `card` (Card/Header/Title/Description/Content), `table`, `badge`, `input`, `label`,
`separator`. Pattern for every primitive: `React.forwardRef`, `cn()` for class merge, `cva`
for variants.

- `Button` variants: `default | destructive | outline | secondary | ghost | link`;
  sizes `default | sm | lg | icon`.
- `Badge` variants: `default | secondary | destructive | success | warning | outline`.
- Map a domain status to a badge with `components/status-badge.tsx` (`StatusBadge`).
- Sizing is via Tailwind classes, not variant props (icons `size-4` / `size-3`).

Adding a primitive: copy the shadcn source shape, theme it with tokens only, drop it in
`components/ui/`. Don't pull in a component library.

## Architecture patterns

### Auth & data fetching

- The session token lives in an httpOnly cookie (`dashboard_token`); `middleware.ts` gates
  every route and keeps `/login` + `/register` public.
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

### No Radix → native, styled

Use a native `<select>` styled with token classes for dropdowns. Prefer dedicated pages or
inline forms over modals; there is no Dialog primitive.

## Information architecture

Tenant-shaped navigation: **Organization → Project → resource**.

- `/` — the user's organizations + create-org form.
- `/organizations/[orgId]` — the org's projects (+ create) and members.
- `/projects/[projectId]` — overview (environments, API keys, webhooks) with a sub-nav to
  pools / matches / deliveries / ratings. Pages link back to their organization.

## Do / Don't

- Do: reuse `ui/` primitives; theme tokens only; `font-mono` for identifiers; server actions
  for every mutation; give empty/error states a real treatment.
- Don't: add Radix or eslint; use ad-hoc hex/palette colors for surfaces; fetch the API from
  the client or expose the token; nest cards inside cards.

## Build gotcha

If `next build` fails with a middleware `EvalError` or a `/_not-found` build-trace error
(transient on Windows), delete `apps/web/.next` and rebuild.
