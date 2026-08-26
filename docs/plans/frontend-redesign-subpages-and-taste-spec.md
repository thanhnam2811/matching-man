# Specification & Implementation Plan: Frontend Redesign, Subpage Restructuring & Taste Polish

**Goal:** Eliminate purple/indigo tints across `apps/web`, replace inline form bloat with clear dedicated subpages, bind scrolling views in demo and tables, and enforce pure zinc monochrome high-contrast design system.

---

## 1. Context & Motivation

1. **Color Tint Violation:**
    - CSS variables in `apps/web/app/globals.css` used HSL `234 89% 74%` (indigo/periwinkle/purple) for `--primary` in dark mode and `243 75% 59%` in light mode.
    - `BrandMark` used `from-indigo-500 to-violet-600`.
    - The user requested an immediate removal of all purple/violet styling in favor of a crisp, industrial, high-contrast monochrome design system (Zinc base).

2. **Layout Bloat & Inline Expansion Issue:**
    - The Project Overview page (`/dashboard/projects/[projectId]`) previously stacked 6 massive cards: Metrics, Environments, API Keys (with inline create key form), Webhooks (with inline 12-checkbox event form), Penalty Escalation Ladder, and Project Members (with inline invite form).
    - When users clicked "Create API Key" or "Add Webhook", the forms inflated inline and pushed the entire page down indefinitely.
    - The user explicitly requested: **Avoid modals where possible; use dedicated, transparent, bookmarkable pages/subpages for clear information architecture.**

3. **Live Demo Viewport Inflation:**
    - The `/demo` page lists (Queue, Matches, Events) grew infinitely as players were added, stretching the viewport.
    - Mode switcher used purple button styling.
    - React StrictMode unmount lifecycle bug in `pollCancelledRef` prevented live matches from appearing without manual page refresh.

---

## 2. Architecture & Design Specification

### 2.1 Theme & Color System (`app/globals.css`, `components/brand-mark.tsx`, `components/stat-card.tsx`)

- **Dark Mode (Default):**
    - `--background`: `240 10% 3.9%` (Dark zinc)
    - `--foreground`: `0 0% 98%` (Crisp off-white)
    - `--card`: `240 6% 10%`
    - `--card-foreground`: `0 0% 98%`
    - `--primary`: `0 0% 98%` (High-contrast pure off-white for primary buttons)
    - `--primary-foreground`: `240 5.9% 10%` (Deep dark zinc text)
    - `--secondary`: `240 3.7% 15.9%`
    - `--secondary-foreground`: `0 0% 98%`
    - `--muted`: `240 3.7% 15.9%`
    - `--muted-foreground`: `240 5% 64.9%`
    - `--border`: `240 4% 18%`
    - `--ring`: `240 5% 64.9%`
- **Light Mode:**
    - `--primary`: `240 5.9% 10%` (Deep zinc)
    - `--primary-foreground`: `0 0% 98%` (White)
    - `--ring`: `240 5% 64.9%`
- **Brand Mark:**
    - Industrial monochrome dot mark: `bg-zinc-900 border border-zinc-700 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-300`.
- **Sparklines & Stat Cards (`components/stat-card.tsx`):**
    - Replace residual `text-indigo-600 dark:text-indigo-500` with `text-foreground` for a clean neutral sparkline.

---

### 2.2 Project Sitemap & Dedicated Subpages

Instead of dumping everything on `/dashboard/projects/[projectId]`, the project structure is split into transparent, focused subpages:

```
/dashboard/projects/[projectId]
├── (Overview)    ➔ Core Operational Metrics (4 StatCards, 14-day sparkline), Match Pools snapshot table, Recent Matches snapshot table, and Navigation tiles to subpages.
├── /pools        ➔ Matchmaking pools live table with queue counts & copy buttons.
├── /matches      ➔ Matches history table with status badges and detail slide-over drawer.
├── /disputes     ➔ Match disputes log and operator outcome resolution.
├── /penalties    ➔ Player dodge penalties active cooldowns & ladder penalties log.
├── /deliveries   ➔ Webhook delivery history, status pills, and payload inspection drawer.
├── /ratings      ➔ Rating history events log with player copy buttons.
├── /api-keys     ➔ [NEW SUBPAGE] Dedicated page for API Keys management & Target Environments.
├── /webhooks     ➔ [NEW SUBPAGE] Dedicated page for Webhook Endpoints & 12-event subscriptions.
└── /settings     ➔ [NEW SUBPAGE] Dedicated page for Ready Check & Dodge Penalty Escalation Ladder + Project Members.
```

---

### 2.3 Navigation & Sidebar Consistency

1. **`components/project-nav.tsx`:**
    - Update `projectNavItems(projectId)` with all 10 distinct routes:
        - Overview (`LayoutDashboard`)
        - Pools (`Layers`)
        - Matches (`Swords`)
        - Disputes (`Scale`)
        - Penalties (`ShieldAlert`)
        - Deliveries (`Webhook`)
        - Ratings (`TrendingUp`)
        - API Keys (`KeyRound`)
        - Webhooks (`RadioTower`)
        - Settings (`Settings`)
    - Horizontal tab nav for mobile/tablet screens.
2. **`components/dashboard-sidebar.tsx`:**
    - Uses `projectNavItems(projectId)` so the desktop sidebar automatically reflects all 10 subpages with active highlight.

---

### 2.4 Component Polish & Form Ergonomics

1. **`components/webhooks-manager.tsx`:**
    - Collapsible creation form with `[+ Add endpoint]` / `[Cancel]` toggle button.
    - Clean 3-column event subscription grid with styled checkboxes.
    - Endpoint cards displaying URL with `CopyButton`, event tags, active status pill, and disable/delete actions.
2. **`components/api-keys-manager.tsx`:**
    - Clear creation bar and clean API key table with prefix/last4, status badge, copy button, and revocation confirmation.
3. **`components/environments-manager.tsx`:**
    - Clean environment list with create form and delete confirmation.
4. **`components/members-manager.tsx`:**
    - Team member list with role badges and invite form.
5. **`components/penalties/penalty-settings-card.tsx`:**
    - Dodge penalty enable switch, decay hours, and multi-tier escalation ladder inputs.

---

### 2.5 Live Matchmaking Demo Viewport Bounding (`components/demo-board.tsx`)

1. **Strict Height Bounding:**
    - Queue list: wrapped in `max-h-[380px] overflow-y-auto pr-1`.
    - Matches list: wrapped in `max-h-[380px] overflow-y-auto pr-1`.
    - Events log: wrapped in `max-h-[220px] overflow-y-auto pr-1`.
2. **Controls & Mode Switcher:**
    - Segmented pill toggle (`bg-muted/50 p-1 border rounded-lg`) for `Skill 1v1` vs `Casual 1v1` with active pill `bg-background text-foreground shadow-sm border border-border/60`.
    - Rating input with randomizer button and "Add player" action.
3. **React Lifecycle Bugfix:**
    - Guarantee `pollCancelledRef.current = false;` on mount in `useEffect` so that dev mode StrictMode remount never freezes polling loops.

---

### 2.6 Documentation & Token Alignment (`apps/web/DESIGN.md`)

- Update route map table to document `/api-keys`, `/webhooks`, and `/settings`.
- Document the monochrome Zinc token palette and the subpage information architecture.

---

## 3. Step-by-Step Execution Plan

- [ ] **Phase 1: Color Tokens & Brand System**
    - Update `apps/web/app/globals.css` with neutral zinc monochrome tokens.
    - Update `apps/web/components/brand-mark.tsx` to industrial monochrome.
- [ ] **Phase 2: Project Subpages Creation**
    - Create `apps/web/app/dashboard/projects/[projectId]/api-keys/page.tsx`.
    - Create `apps/web/app/dashboard/projects/[projectId]/webhooks/page.tsx`.
    - Create `apps/web/app/dashboard/projects/[projectId]/settings/page.tsx`.
- [ ] **Phase 3: Project Overview Refactoring**
    - Refactor `apps/web/app/dashboard/projects/[projectId]/page.tsx` into a high-signal metrics dashboard with pool/match snapshots and direct subpage navigation cards.
- [ ] **Phase 4: Navigation Synchronization**
    - Update `apps/web/components/project-nav.tsx` and verify `dashboard-sidebar.tsx`.
- [ ] **Phase 5: Component Ergonomics & Demo Bounding**
    - Update `apps/web/components/webhooks-manager.tsx` with collapsible endpoint form.
    - Update `apps/web/components/demo-board.tsx` with bounded scroll containers, segmented monochrome toggle, and StrictMode fix.
- [ ] **Phase 6: Design System Docs Update**
    - Update `apps/web/DESIGN.md`.
- [ ] **Phase 7: Verification & Quality Assurance**
    - `pnpm --dir apps/web typecheck` (0 errors).
    - `pnpm lint` (0 warnings, 0 errors).
    - `pnpm --dir apps/web build` (19/19 routes generated cleanly).
    - `pnpm api:test` (33 suites, 198 tests passed).
- [ ] **Phase 8: Git Commit & Delivery**

---
