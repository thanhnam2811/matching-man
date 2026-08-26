# Specification & Implementation Plan: Complete Extraction of Creation Forms to Dedicated Pages

**Goal:** Eliminate all remaining inline creation forms (`add org`, `add project`, `add webhook`, `add api-key`) across `apps/web` and replace them with dedicated, bookmarkable creation pages with clear breadcrumb navigation.

---

## 1. Context & Identified Inline Forms

In the current dashboard:

1. **`/dashboard` (Organizations overview):** Renders an inline card with `<CreateOrganizationForm />` right in the page flow.
2. **`/dashboard/organizations/[orgId]` (Organization detail):** Renders an inline card with `<CreateProjectForm />` above the projects list.
3. **`/dashboard/projects/[projectId]/webhooks` (Webhooks subpage):** Renders an expandable inline form within the endpoint list.
4. **`/dashboard/projects/[projectId]/api-keys` (API Keys subpage):** Renders an inline creation form above the key table.

**User Directive:** "các form vẫn còn inline: add org, project, webhook... Hạn chế modal, nên dùng page/subpage để tường minh."

---

## 2. Target Architecture & Route Map

### 2.1 Complete Route Structure

| Route                                               | Page Type             | Content / Purpose                                                       | Actions / Navigation                                                                 |
| :-------------------------------------------------- | :-------------------- | :---------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| **`/dashboard`**                                    | List / Overview       | Clean grid of user's organizations                                      | Top-right button `[+ New organization]` ➔ `/dashboard/organizations/new`             |
| **`/dashboard/organizations/new`**                  | Dedicated Create Page | Focused card with organization creation form                            | Breadcrumbs `Organizations > New`, Cancel / Submit actions                           |
| **`/dashboard/organizations/[orgId]`**              | Overview / List       | Org details, projects grid, member list                                 | Top-right button `[+ New project]` ➔ `/dashboard/organizations/[orgId]/projects/new` |
| **`/dashboard/organizations/[orgId]/projects/new`** | Dedicated Create Page | Focused card with project creation form (Name, slug, default region)    | Breadcrumbs `Organizations > [Org Name] > New Project`, Cancel / Submit              |
| **`/dashboard/projects/[projectId]/webhooks`**      | List Page             | Clean list of registered endpoints, status pills, copy buttons          | Top-right button `[+ New webhook]` ➔ `/dashboard/projects/[projectId]/webhooks/new`  |
| **`/dashboard/projects/[projectId]/webhooks/new`**  | Dedicated Create Page | Full-page form for endpoint URL & 12-event subscription checkboxes      | Breadcrumbs `[Project] > Webhooks > New`, Cancel / Save                              |
| **`/dashboard/projects/[projectId]/api-keys`**      | List Page             | API keys table (prefixes, last4, revoked badges) & Environments manager | Top-right button `[+ New API key]` ➔ `/dashboard/projects/[projectId]/api-keys/new`  |
| **`/dashboard/projects/[projectId]/api-keys/new`**  | Dedicated Create Page | Form to generate key + one-time secret display banner with CopyButton   | Breadcrumbs `[Project] > API Keys > New`, Cancel / Generate                          |

---

## 3. Component & Action Adaptations

1. **Form Redirections (`lib/actions.ts`):**
    - When creating an organization successfully, redirect cleanly to `/dashboard/organizations/${org.id}` or `/dashboard`.
    - When creating a project successfully, redirect to `/dashboard/projects/${project.id}`.
    - When creating a webhook successfully, redirect to `/dashboard/projects/${projectId}/webhooks`.
    - When generating an API key, display the one-time raw secret with a prominent copy banner and a "Return to API Keys" button on `/dashboard/projects/[projectId]/api-keys/new`.

2. **Clean Page Layouts:**
    - Empty states on list pages will include a direct call-to-action button linking to the dedicated creation page instead of asking the user to look above at an inline form.

3. **Breadcrumbs & Back Navigation:**
    - All creation pages have standardized `<Breadcrumbs />` headers for effortless navigation back to parent collections.

---

## 4. Step-by-Step Implementation Tasks

- [ ] **Task 1: Dedicated Organization Creation Page**
    - Create `apps/web/app/dashboard/organizations/new/page.tsx`.
    - Refactor `apps/web/app/dashboard/page.tsx` to remove inline form card, add header action button `[+ New organization]`, and update `<EmptyState />` action href.
- [ ] **Task 2: Dedicated Project Creation Page**
    - Create `apps/web/app/dashboard/organizations/[orgId]/projects/new/page.tsx`.
    - Refactor `apps/web/app/dashboard/organizations/[orgId]/page.tsx` to remove inline form card, add header action button `[+ New project]`, and update `<EmptyState />` action href.
- [ ] **Task 3: Dedicated Webhook Creation Page**
    - Create `apps/web/app/dashboard/projects/[projectId]/webhooks/new/page.tsx`.
    - Refactor `apps/web/app/dashboard/projects/[projectId]/webhooks/page.tsx` and `components/webhooks-manager.tsx` to display only the registered endpoints with a top-right `[+ New webhook]` link to `/webhooks/new`.
- [ ] **Task 4: Dedicated API Key Creation Page**
    - Create `apps/web/app/dashboard/projects/[projectId]/api-keys/new/page.tsx`.
    - Refactor `apps/web/components/api-keys-manager.tsx` and `apps/web/app/dashboard/projects/[projectId]/api-keys/page.tsx` with a top-right `[+ New API key]` link to `/api-keys/new`.
- [ ] **Task 5: Documentation Update**
    - Update `apps/web/DESIGN.md` route map table with all 4 new creation subpages.
- [ ] **Task 6: Verification & Validation**
    - `pnpm --dir apps/web typecheck` (0 errors).
    - `pnpm lint` (0 warnings, 0 errors).
    - `pnpm --dir apps/web build` (All static & dynamic routes pass).
    - `pnpm api:test` (198/198 unit tests pass).
- [ ] **Task 7: Git Commit**

---
