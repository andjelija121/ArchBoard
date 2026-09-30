# Unit 06: Project Persistence (Server Actions)

## Goal

Replace the in-memory mock project hook with real, owner-scoped persistence:
the `/editor` home lists the signed-in owner's projects from Postgres, and the
Create / Rename / Delete dialogs mutate real `Project` rows through Server
Actions. Projects survive a page refresh and are isolated per Clerk user.

## Design

- No new screens or visual redesign — this unit swaps the data layer behind the
  existing editor home, sidebar, and three dialogs (built in Unit 04). The UI
  shape stays identical.
- **New, small UI additions only:**
  - An inline **error line** inside each dialog when a Server Action fails,
    using `text-destructive` (→ `--state-error`) at `text-xs`. Failures must
    never throw an unhandled exception to the client (`code-standards.md` →
    "Handle external failures gracefully").
  - Pending button labels already exist ("Creating…/Saving…/Deleting…"); keep
    them, now driven by a real pending state instead of a mock timer.
- The **Shared** tab renders real collaborator projects (empty in practice
  until a collaborator-add flow exists — decided in the build plan). Owned rows
  keep their Rename/Delete actions; shared rows stay action-less.
- Slug is now a **stored, owner-unique column** (build-plan decision). The live
  slug preview in the Create dialog remains a client-side hint; the server
  computes the final, de-duplicated slug of record.

## Implementation

### 1. Prisma — add `slug` to `Project`

In `prisma/models/project.prisma`, add to `Project`:

- `slug String @map("slug")`
- `@@unique([ownerId, slug])` — slug is unique **per owner**, not globally
  (two different users may both have a `payments-platform`).

Keep all existing fields/indexes. Run `prisma migrate dev --name project_slug`
and regenerate the client.

> **Existing-row note:** adding a `NOT NULL` unique column to a table that
> already holds dev rows will fail without a backfill. Because this is
> pre-launch dev data, either reset the dev database (`prisma migrate reset`) or
> backfill each row's slug before the constraint applies. Do **not** edit the
> historical `init` / `canvas_jsonb` migrations (protected).

### 2. `lib/projects.ts` — shared types + slug helper

Create `lib/projects.ts` to replace `lib/mock-projects.ts`:

- `export interface ProjectListItem { id: string; name: string; slug: string; owner: boolean }`
  — the serializable shape passed from Server Components to client components.
  Intentionally the same field set as the old `MockProject` so client
  components change only their import.
- Move `slugify(value: string): string` here (unchanged logic) so both the
  client preview and the server actions share one implementation.
- Delete `lib/mock-projects.ts` (its seed arrays and `MockProject` type are
  gone; `sharedProjects`/`initialOwnedProjects` are no longer imported anywhere).

### 3. `app/editor/actions.ts` — Server Actions

New file, top-level `"use server"`. Every action:

1. Resolves `const { userId } = await auth()`; if falsy, returns
   `{ ok: false, error: "Not signed in." }` (no throw).
2. Validates input with a Zod schema **before** any Prisma call
   (`code-standards.md` → validate at boundaries).
3. Enforces ownership by scoping the `where` clause to `ownerId: userId`
   (never trusts a client-supplied ownerId).
4. Calls `revalidatePath("/editor")` on success so the RSC tree refetches.
5. Returns a discriminated result: `{ ok: true } | { ok: false, error: string }`.

**Schemas (Zod):**

- `nameSchema = z.string().trim().min(1, "Name is required.").max(100, "Name is too long.")`
- `createInput = z.object({ name: nameSchema })`
- `renameInput = z.object({ id: z.string().min(1), name: nameSchema })`
- `deleteInput = z.object({ id: z.string().min(1) })`

**`generateUniqueSlug(ownerId, name, excludeId?)` (module-local helper):**

- `const base = slugify(name) || "project"`.
- Fetch the owner's existing slugs that collide:
  `prisma.project.findMany({ where: { ownerId, slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { slug: true } })`.
- Return `base` if free, else `base-2`, `base-3`, … (first integer suffix not
  in the set). Deterministic, no race-proofing beyond the DB unique constraint
  (a rare concurrent collision surfaces as a caught Prisma `P2002` → retry once
  or return a friendly error).

**Actions:**

- `createProject(input: unknown)`: parse `createInput`; `slug = await generateUniqueSlug(userId, name)`; `prisma.project.create({ data: { ownerId: userId, name, slug } })` (status defaults `DRAFT`, description/canvas left null); revalidate; return ok. No redirect — the board route doesn't exist until Unit 07.
- `renameProject(input)`: parse `renameInput`; `slug = await generateUniqueSlug(userId, name, id)`; `const res = await prisma.project.updateMany({ where: { id, ownerId: userId }, data: { name, slug } })`; if `res.count === 0` return `{ ok: false, error: "Project not found." }`; revalidate; return ok.
- `deleteProject(input)`: parse `deleteInput`; `const res = await prisma.project.deleteMany({ where: { id, ownerId: userId } })` (collaborators cascade via existing `onDelete: Cascade`); if `res.count === 0` return not-found error; revalidate; return ok.

Wrap each Prisma section in try/catch → return `{ ok: false, error }` with a
generic message (log the real error server-side); handle `P2002` (slug race)
distinctly if it occurs.

### 4. `app/editor/page.tsx` — server-side fetch

Keep `await auth.protect()`. Then:

- `const { userId } = await auth()`.
- Resolve the user's email for the Shared query via
  `const user = await currentUser()` → `user?.primaryEmailAddress?.emailAddress`
  (from `@clerk/nextjs/server`).
- Owned: `prisma.project.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, slug: true } })` → map to `ProjectListItem` with `owner: true`.
- Shared: only if an email exists —
  `prisma.project.findMany({ where: { collaborators: { some: { collaboratorEmail: email } } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, slug: true } })` → map with `owner: false`. (Returns empty for now; correct once collaborators can be added.)
- Render `<EditorShell ownedProjects={owned} sharedProjects={shared} />`.

`page.tsx` becomes the data boundary; it stays an async Server Component.

### 5. `components/editor/use-project-dialogs.ts` — rewrite to call actions

The hook no longer owns the project list (the server does). It keeps:

- `dialog: "create" | "rename" | "delete" | null`, `activeProject: ProjectListItem | null`, `name`, `error: string | null`.
- Pending via `const [isPending, startTransition] = React.useTransition()`;
  expose it as `isSubmitting` (keep the existing prop name to avoid churn).
- `openCreate/Rename/Delete`, `closeDialog` (also clears `error`), `setName`,
  `slugPreview = slugify(name)`.
- `submitCreate/Rename/Delete`: clear error, then `startTransition(async () => { const res = await <action>(payload); if (res.ok) closeDialog(); else setError(res.error) })`. Remove the mock `setTimeout`, the version/`isSubmittingRef` guards (the transition provides pending state), and the `initialOwnedProjects` import.
- Remove `ownedProjects`/`setOwnedProjects` from the hook's state and return value.

Keep `UseProjectDialogsReturn` exported.

### 6. `components/editor/editor-shell.tsx` — receive server data

- Add props: `ownedProjects: ProjectListItem[]`, `sharedProjects: ProjectListItem[]`.
- Pass them straight into `ProjectSidebar` (instead of the removed
  `sharedProjects` mock import and the hook's old `ownedProjects`).
- Thread the hook's new `error` into each dialog.
- Everything else (sidebar toggle, render-prop children, dialog wiring)
  unchanged.

### 7. Client component type swaps + error slot

- `project-sidebar.tsx`, `project-dialogs.tsx`: change
  `import type { MockProject } from "@/lib/mock-projects"` →
  `import type { ProjectListItem } from "@/lib/projects"` and rename the type in
  their props. No structural/markup change in the sidebar.
- `project-dialogs.tsx`: add an optional `error?: string | null` prop to all
  three dialogs; when set, render `<p className="text-xs text-destructive">{error}</p>`
  near the footer/body. Slug preview line in Create is unchanged.
- `editor-home.tsx`: unchanged.

## Dependencies

- `zod` (input validation at the Server Action boundary — required by
  `code-standards.md`; first unit that needs it). Install as a runtime dep.
- No other new packages — `@clerk/nextjs`, `prisma`, `@prisma/client`,
  `@prisma/adapter-pg` already present.

## Verify when done

- [ ] Creating a project from the editor-home button **and** the sidebar button
      persists it; it is still there after a full page refresh.
- [ ] Rename updates the name (and the stored slug) and survives refresh.
- [ ] Delete removes the project and survives refresh; its collaborator rows
      cascade away.
- [ ] A second Clerk account sees none of the first account's projects (owner
      isolation); rename/delete of another user's id is a no-op (ownership
      `where` guard).
- [ ] The Shared tab renders without error (empty is expected) using the real
      collaborator query.
- [ ] Slug is stored, unique per owner; two projects named the same yield
      `name` and `name-2`.
- [ ] A forced action failure shows the inline error line, not a crash or
      unhandled rejection.
- [ ] `lib/mock-projects.ts` is deleted and no file imports it.
- [ ] No TypeScript errors.
- [ ] No console errors.
- [ ] Responsive at mobile and desktop (sidebar + dialogs unchanged from Unit 04).
- [ ] `npm run build` passes.
