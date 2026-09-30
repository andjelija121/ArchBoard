# Unit 07: Board Route + React Flow Canvas Scaffold + Snapshot Save/Load

## Goal

Add a per-project board route (`/editor/[projectId]`) that mounts an empty,
interactive React Flow canvas inside the existing editor chrome. The top bar
shows the project title, a save-status indicator, and a manual **Save** button.
A Server Action persists and rehydrates the canvas as a single `{ nodes, edges }`
JSONB payload on the existing `Project.canvas` column. Opening a project →
empty pan/zoom canvas → Save → reload → the board loads back from Postgres.

## Design

- **Layout (from `ui-context.md` → "Editor view"):** full-viewport — the
  existing 48px top bar (`--bg-surface`, bottom border only), and the React Flow
  canvas filling the remaining area on `--bg-base`. No AI sidebar or property
  panel yet (Units 09/11). The project sidebar (Unit 02/06) is unchanged and
  still opens over the canvas.
- **Top bar content (new):** the navbar's currently-empty center and right
  slots are filled on the board route only:
  - **Center:** project title — `text-sm font-medium`, `--text-primary`,
    `truncate` (long names clip, don't wrap the 48px bar).
  - **Right (left of the existing `UserButton`):** a **save-status indicator**
    then the **Save** button.
- **Save-status indicator:** small inline row — a Lucide icon + `text-xs` label,
  color-coded via chrome state tokens (never the node palette):
  | State     | Icon (Lucide)        | Token             | Label        |
  | --------- | -------------------- | ----------------- | ------------ |
  | idle/clean| `Check`              | `--text-subtle`   | "Saved"      |
  | dirty     | `Circle` (or dot)    | `--state-warning` | "Unsaved"    |
  | saving    | `Loader2` (spin)     | `--text-muted`    | "Saving…"    |
  | saved     | `Check`              | `--state-success` | "Saved"      |
  | error     | `AlertCircle`        | `--state-error`   | "Save failed"|
  Icons at `h-4 w-4`, 1.5px stroke (per `ui-context.md` → Icons).
- **Save button:** shadcn `Button`, default (accent) variant, `size="sm"`,
  `Save` icon + "Save"; disabled while `saving` and when the board is clean
  (nothing to save). Label becomes "Saving…" during the transition.
- **Canvas chrome:** dark to match the theme — React Flow `colorMode="dark"`,
  a dotted `Background`, and bottom-left `Controls` (zoom/fit). Border radius and
  surfaces follow tokens; canvas sits on `--bg-base`.
- **Empty state:** an empty board is valid and shows just the grid. No custom
  "add your first node" overlay here — the add-node toolbar is Unit 08.
- **Z-index (from `ui-context.md`):** the canvas is the base layer (`z-0`); it
  must stay below the project sidebar (`z-40`) and dialogs (`z-50`). React
  Flow's own panels (Controls) live inside the canvas layer.

## Implementation

### 1. Dependency + global canvas styles

- Install **`@xyflow/react`** (React Flow v12 — the current package name; v11
  `reactflow` peer-deps on React 18 and won't install cleanly on this project's
  React 19.2 / Next 16). The build plan's "reactflow" refers to this library;
  its `Introduces` line and this unit's reference are updated to `@xyflow/react`.
- Import React Flow's stylesheet **once**, at the top of the canvas client
  component (`board-canvas.tsx`): `import "@xyflow/react/dist/style.css"`.
- React Flow theming: prefer `colorMode="dark"` on `<ReactFlow>`. Any residual
  color overrides (grid dot color, Controls button surfaces to match
  `--bg-surface`/`--border-default`) go in a single small
  `components/canvas/react-flow-overrides.css` imported alongside the component —
  this is the one place `code-standards.md` → Styling permits a `.css` file
  ("React Flow overrides"). Do **not** hardcode hex; reference the existing CSS
  custom properties (e.g. `--border-default`, `--bg-surface`, `--accent-primary`
  for selection). No new design tokens are needed for this unit — the `--node-*`
  palette and its consumers belong to Unit 08.

### 2. `lib/canvas.ts` — shared snapshot types + validation

New file, the single source of truth for the persisted canvas shape (imported by
both the page loader and the Save action; mirrors how `lib/projects.ts` is shared):

- `import type { Node, Edge } from "@xyflow/react"`.
- `export type BoardNode = Node` and `export type BoardEdge = Edge` — thin
  aliases so Unit 08 can later narrow `data`/`type` without churning imports.
- `export interface CanvasSnapshot { nodes: BoardNode[]; edges: BoardEdge[] }`.
- `export const EMPTY_SNAPSHOT: CanvasSnapshot = { nodes: [], edges: [] }`.
- **Zod schema (Zod 4 syntax)** — validates both directions (client → Save
  action, and the untrusted `Json` read back from Postgres). Keep it structural
  and forward-compatible: preserve unknown React Flow fields so Unit 08/09 data
  survives a round-trip.
  ```ts
  const positionSchema = z.object({ x: z.number(), y: z.number() })
  // z.looseObject keeps unknown keys (React Flow attaches many); Zod 4 form.
  const nodeSchema = z.looseObject({
    id: z.string().min(1),
    position: positionSchema,
    data: z.record(z.string(), z.unknown()).default({}),
    type: z.string().optional(),
  })
  const edgeSchema = z.looseObject({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
  })
  export const canvasSnapshotSchema = z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  })
  ```
- `export function parseCanvas(value: unknown): CanvasSnapshot` — runs
  `canvasSnapshotSchema.safeParse`; returns the parsed snapshot on success,
  `EMPTY_SNAPSHOT` on failure or when `value` is `null`/`undefined` (a `null`
  column = empty board, per the build plan). Cast the validated result to
  `CanvasSnapshot` (the loose schema is structurally compatible with React
  Flow's types for the fields we assert). Never `any`.

### 3. `app/editor/[projectId]/page.tsx` — server loader

New dynamic route, async Server Component (data boundary, like
`app/editor/page.tsx`):

1. `await auth.protect()`, then `const { userId } = await auth()`; if falsy
   `return null`.
2. `const { projectId } = await params` (Next 16 async params).
3. Fetch owner-scoped:
   ```ts
   const project = await prisma.project.findFirst({
     where: { id: projectId, ownerId: userId },
     select: { id: true, name: true, canvas: true },
   })
   ```
   Scoping to `ownerId: userId` means another user's board (or a bad id) simply
   isn't found — no separate 403 path. (Guest/shared access arrives with share
   links in Unit 14; for now only the owner can open a board.)
4. If `!project`, call `notFound()` (`next/navigation`).
5. `const snapshot = parseCanvas(project.canvas)`.
6. Render the board client component inside the existing chrome:
   ```tsx
   <BoardEditor
     projectId={project.id}
     projectName={project.name}
     initialSnapshot={snapshot}
     ownedProjects={ownedProjects}
     sharedProjects={sharedProjects}
   />
   ```
   Reuse the same owned/shared project queries as `app/editor/page.tsx` so the
   project sidebar still works on the board route. **Extract** the owned/shared
   fetch+map into a small helper (e.g. `getProjectLists(userId, email)` in
   `lib/projects.ts` or a local `app/editor/_data.ts`) and call it from both
   pages rather than duplicating the query.

### 4. `app/editor/[projectId]/actions.ts` — Save Server Action

New file, top-level `"use server"`. Follows the exact pattern of
`app/editor/actions.ts`:

- `type ActionResult = { ok: true } | { ok: false; error: string }`.
- Schema: `const saveInput = z.object({ projectId: z.string().min(1), snapshot: canvasSnapshotSchema })`.
- `export async function saveCanvas(input: unknown): Promise<ActionResult>`:
  1. `const { userId } = await auth()`; if falsy → `{ ok: false, error: "Not signed in." }`.
  2. `const parsed = saveInput.safeParse(input)`; on failure return the first
     issue message (reuse the `firstIssue` pattern from `actions.ts`).
  3. Ownership-scoped write:
     ```ts
     const result = await prisma.project.updateMany({
       where: { id: parsed.data.projectId, ownerId: userId },
       data: { canvas: parsed.data.snapshot as Prisma.InputJsonValue },
     })
     if (result.count === 0) return { ok: false, error: "Project not found." }
     ```
     `updateMany` + the `ownerId` guard means another user's id is a no-op
     not-found, never a leak or a throw (same guarantee as rename/delete).
  4. Wrap the Prisma call in try/catch → log server-side, return a generic
     `{ ok: false, error: "Couldn't save. Please try again." }`.
  5. **Do not** `revalidatePath` — the canvas is client-owned live state;
     re-running the RSC loader mid-session would clobber unsaved in-memory edits
     (respects invariant #3: DB is snapshot-only, not the live source). The
     client updates its own save-status on the returned result.
- No `loadCanvas` action — loading happens in the Server Component (step 3).

### 5. `components/canvas/board-editor.tsx` — board client shell

New client component (`"use client"`). Owns the live canvas state and the
save lifecycle, and injects the title + save controls into the chrome. This is
the board analogue of how `EditorShell` lifts shared state to one owner.

- Props: `{ projectId: string; projectName: string; initialSnapshot: CanvasSnapshot; ownedProjects: ProjectListItem[]; sharedProjects: ProjectListItem[] }`.
- Wrap everything in `<ReactFlowProvider>` (from `@xyflow/react`) so the canvas
  and any future toolbar share one flow instance.
- Canvas state via React Flow's controlled hooks:
  `const [nodes, setNodes, onNodesChange] = useNodesState(initialSnapshot.nodes)`
  and `const [edges, setEdges, onEdgesChange] = useEdgesState(initialSnapshot.edges)`.
- **Dirty tracking:** a `status` state machine
  `"clean" | "dirty" | "saving" | "saved" | "error"`. Mark `dirty` on any
  `onNodesChange`/`onEdgesChange` that represents a real user edit; a small
  helper wraps the change handlers to set `dirty` (but see note: pure
  `select`/`dimensions` changes shouldn't flip to dirty — for Unit 07 the board
  is empty so any change is fine; keep the wrapper minimal and note it for
  Unit 08 refinement). `saved` auto-reverts to `clean` visually after a short
  timeout, or simply render `saved` until the next edit — pick the simpler:
  render `"Saved"` (success tint) until the next change flips it to `dirty`.
- **Save:** `const [isPending, startTransition] = React.useTransition()`.
  `handleSave` calls `startTransition(async () => { setStatus("saving"); const res = await saveCanvas({ projectId, snapshot: { nodes, edges } }); setStatus(res.ok ? "saved" : "error"); if (!res.ok) setSaveError(res.error) })`.
  Guard against saving when `status === "saving"` or clean.
- Compose the chrome by extending `EditorShell` with navbar slots (see §7):
  ```tsx
  <EditorShell
    ownedProjects={ownedProjects}
    sharedProjects={sharedProjects}
    navbarCenter={<BoardTitle name={projectName} />}
    navbarActions={
      <>
        <SaveStatus status={status} />
        <SaveButton status={status} disabled={isPending || status === "clean" || status === "saved"} onSave={handleSave} />
      </>
    }
  >
    {() => (
      <BoardCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
      />
    )}
  </EditorShell>
  ```
  `onConnect` (from `useReactFlow`/`addEdge`) can be wired now so dragging
  between handles works once nodes exist (Unit 08); for an empty board it's a
  harmless no-op. Keep `SaveStatus`/`SaveButton`/`BoardTitle` as tiny local
  components or inline — they're presentational.

### 6. `components/canvas/board-canvas.tsx` — the React Flow viewport

New client component (`"use client"`), purely presentational (no data fetching,
no save logic — `code-standards.md`: don't mix concerns):

- `import "@xyflow/react/dist/style.css"` and the overrides CSS from §1.
- Props: `{ nodes, edges, onNodesChange, onEdgesChange, onConnect }` typed with
  React Flow's `OnNodesChange`/`OnEdgesChange`/`OnConnect` and `BoardNode[]`/
  `BoardEdge[]`.
- Render:
  ```tsx
  <div className="h-full w-full">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      colorMode="dark"
      fitView
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls />
    </ReactFlow>
  </div>
  ```
- The parent children slot (`EditorShell`'s `relative flex-1 overflow-hidden`)
  already resolves a definite height (root `body` is `h-dvh`), so `h-full w-full`
  gives React Flow the explicit dimensions it requires. No node/edge `type`
  registries yet (custom nodes are Unit 08) — default nodes only.

### 7. `components/editor/editor-shell.tsx` + `editor-navbar.tsx` — navbar slots

Extend the shared chrome with **optional** slots so the board route can place
content in the top bar without a parallel layout:

- `EditorNavbar`: add optional props `centerSlot?: React.ReactNode` and
  `actionsSlot?: React.ReactNode`. Render `centerSlot` inside the existing empty
  center `<div className="flex flex-1 items-center justify-center">`, and render
  `actionsSlot` in the right `<div ... justify-end>` **before** `<UserButton />`
  (add a `gap-2` if not present). When a slot is omitted, the navbar renders
  exactly as today (`/editor` home is unaffected).
- `EditorShell`: add optional `navbarCenter?: React.ReactNode` and
  `navbarActions?: React.ReactNode`; forward them to `EditorNavbar`'s
  `centerSlot`/`actionsSlot`. All existing props/behavior unchanged.

### 8. `components/editor/project-sidebar.tsx` — make rows open boards

The tracker notes project rows aren't clickable yet; this unit wires them:

- In the "My Projects" list, wrap the project **name** in a Next `<Link
  href={`/editor/${project.id}`}>` (keep it `flex-1 truncate text-sm`, add a
  hover affordance and `focus-visible` ring). The Rename/Delete icon buttons stay
  to its right and must not be inside the link.
- Do the same for the "Shared" list rows (also `/editor/${project.id}`), since
  the loader already owner-scopes and will simply `notFound()` for a board the
  viewer can't open until Unit 14 grants shared access. (Alternatively leave
  shared rows non-clickable for now — but linking is harmless and forward-looking;
  pick linking.)
- On click, close the sidebar (mobile) — call the existing `onClose` from the
  link's `onClick` so the overlay doesn't cover the board after navigation.
  Import `Link` from `next/link`.

## Dependencies

- `@xyflow/react` (React Flow v12 — the interactive node canvas; React 19 /
  Next 16 compatible, unlike the v11 `reactflow` package). Runtime dep.
- No other new packages — `zod`, `@clerk/nextjs`, `prisma`, `@prisma/client`,
  `@prisma/adapter-pg` are already present.

## Verify when done

- [ ] Clicking a project row in the sidebar navigates to `/editor/[projectId]`
      and mounts an empty React Flow canvas inside the editor chrome.
- [ ] The canvas pans (drag) and zooms (wheel / Controls); the dotted grid and
      bottom-left zoom controls render in the dark theme.
- [ ] The top bar shows the project title (center) and the save-status indicator
      + Save button (right, before the user menu).
- [ ] Clicking **Save** persists `{ nodes, edges }` to `Project.canvas` (JSONB);
      a full page reload rehydrates the same board from Postgres.
- [ ] An empty board saves and reloads as empty (no crash on `null` canvas).
- [ ] Opening a board id that doesn't exist, or one owned by another Clerk
      account, renders `not-found` (owner isolation; no data leak, no throw).
- [ ] Save of another user's board id is a no-op not-found via the `ownerId`
      `where` guard (no unhandled rejection).
- [ ] Save-status transitions clean → dirty (on edit) → saving → saved, and
      shows the error state on a forced action failure instead of crashing.
- [ ] Canvas stays below the project sidebar (`z-40`) and dialogs (`z-50`); the
      sidebar still opens/closes over the board.
- [ ] `/editor` home still renders with an empty navbar center/right (slots are
      optional and unused there).
- [ ] No TypeScript errors (no `any`; canvas types come from `@xyflow/react`).
- [ ] No console errors (React Flow CSS imported; container has a definite size).
- [ ] Responsive at mobile and desktop (canvas fills the viewport; sidebar
      overlays and closes on navigation).
- [ ] `npm run build` passes.
