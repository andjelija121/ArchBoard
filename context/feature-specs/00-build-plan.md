# ArchBoard — Build Plan

> The complete system, broken into build-ordered units. This file is the
> single design artifact proving ArchBoard was scoped end-to-end before the
> first implementation prompt. Units 1–5 are already built; units 6–16 are
> the remaining plan.

## Unit rules applied

- Each unit produces **one visible result**.
- Each unit stays within **one system boundary** (`app/`, `components/canvas/`,
  `components/ai/`, `lib/liveblocks/`, `trigger/`, `prisma/`).
- Dependencies are installed/introduced **just in time** — never before the
  unit that first needs them.
- Units that would always be done in the same session are **merged**; units
  with no standalone visible result are **folded into an adjacent unit**.
- The AI sidebar UI and the Trigger.dev/Gemini backend are **deliberately
  split** — `ai-workflow-rules.md` forbids combining UI rendering with
  background-task execution in one step.

---

## Completed units (1–5)

| # | Unit | What it built | Boundary |
| - | ---- | ------------- | -------- |
| 1 | Design system & UI primitives | shadcn/ui install, `button`/`card`/`dialog`/`input`/`tabs`/`textarea`/`scroll-area`, `cn()`, `lucide-react`, dark-only token palette in `globals.css` | `components/ui/`, `app/` |
| 2 | Editor chrome shell | `EditorNavbar` (48px top bar), floating `ProjectSidebar` (Tabs: My Projects / Shared), generic `DialogPattern` wrapper | `components/editor/` |
| 3 | Clerk auth wiring | `ClerkProvider` (dark theme), custom sign-in/sign-up flows, `proxy.ts`, resource-based `auth.protect()`, `/` redirects, `UserButton` | `app/`, `components/auth/` |
| 4 | Project dialogs & editor home | `/editor` home, Create/Rename/Delete dialogs, sidebar row actions, `useProjectDialogs` hook — **mock data only** | `components/editor/` |
| 5 | Prisma schema & data layer | `Project` + `ProjectCollaborator` models, `lib/prisma.ts` cached singleton, initial migration | `prisma/`, `lib/` |

---

## Remaining units (6–16)

### Unit 6 — Real project persistence (Server Actions)  →  spec: `06-project-persistence.md`
- **Builds:** Server Actions that create, rename, and delete `Project` rows
  scoped to the Clerk owner id, replacing the in-memory mock in
  `use-project-dialogs.ts`. The "My Projects" list is loaded from Postgres for
  the signed-in owner; "Shared" runs the real `ProjectCollaborator`-by-email
  query (empty until a collaborator-add flow exists).
- **Visible result:** Create/rename/delete a project on `/editor` and it
  survives a page refresh; a second account sees none of the first account's
  projects.
- **Boundary:** `app/` (Server Actions + server fetch) + `prisma/` (adds a
  `slug` column, unique per owner).
- **Depends on:** Unit 3 (Clerk `userId`/email), Unit 4 (dialogs + hook to wire
  into), Unit 5 (Prisma models + client).
- **Introduces (just in time):** `zod` (first boundary-validation unit).
- **Decisions:** slug is a **stored** owner-unique column; Shared uses the
  **real** query (empty for now). Enforce `ownerId === auth().userId` on every
  mutation. No React Flow yet.

### Unit 7 — Board route + React Flow canvas scaffold + snapshot save/load
- **Builds:** A per-project route (e.g. `/editor/[projectId]`) that mounts an
  empty React Flow canvas inside the existing editor chrome. Top bar shows the
  project title + a save-status indicator and a manual **Save** button. A
  Server Action persists and rehydrates the canvas `{ nodes, edges }` as a
  single JSONB payload.
- **Visible result:** Open a project → see an empty interactive canvas (pan/
  zoom) → click Save → reload → the (empty) board loads back from Postgres.
- **Boundary:** `components/canvas/` + `app/` (route + save/load Server Action).
- **Depends on:** Unit 6 (a real project to open).
- **Introduces (just in time):** `reactflow`.
- **✅ Storage resolved:** the `Project.canvas` JSONB column exists (migration
  `20260930165407_canvas_jsonb` dropped the old `canvasJsonPath` blob pointer
  and added `canvas Json?`), matching `architecture.md` invariant #4. This unit
  reads/writes that column directly as `{ nodes, edges }`; `null` = empty board.

### Unit 8 — Smart infrastructure nodes + swimlane layout + add-node toolbar
- **Builds:** The 6 custom React Flow node types (Client, Load Balancer,
  Compute, Cache, Queue/Broker, Database) with category colors/icons per
  `ui-context.md`, the pure swimlane coordinate helper (category → X column,
  non-overlapping Y), and a small canvas toolbar/palette to add a node
  manually.
- **Visible result:** Click a node type in the toolbar → a styled, draggable
  node spawns in its correct category swimlane; multiple nodes never overlap.
- **Boundary:** `components/canvas/`.
- **Depends on:** Unit 7 (a canvas to render on).
- **Notes:** Merged because node types have no standalone way to appear and
  the swimlane helper has no standalone visible result — they always ship
  together. Establishes the node schema the AI backend (Unit 12) must match.
  Add the `--node-*` and `--radius` tokens flagged open in the tracker.

### Unit 9 — Annotated edges + edge property panel
- **Builds:** Custom annotated edge type and a right-anchored property panel
  that opens on edge click to edit protocol (REST/gRPC/WebSocket), sync/async
  behavior, and primary API route(s) / load estimate.
- **Visible result:** Drag a connection between two nodes → click it → edit
  protocol + API route in the side panel → the edge label updates.
- **Boundary:** `components/canvas/`.
- **Depends on:** Unit 8 (nodes to connect).

### Unit 10 — Bounding boxes (parent grouping)
- **Builds:** Parent/group node that visually wraps child nodes (e.g.
  "Microservices Cluster"); children move with the box.
- **Visible result:** Select nodes → wrap them in a labeled bounding box →
  drag the box and the grouped nodes move together.
- **Boundary:** `components/canvas/`.
- **Depends on:** Unit 8 (nodes to group).

### Unit 11 — AI chat sidebar UI (no backend)
- **Builds:** The persistent right-hand chat sidebar in `components/ai/`:
  prompt input, chat history, and pending/success/error visual states — wired
  to a stubbed submit (no network) for now.
- **Visible result:** Open the sidebar, type a prompt, send it, and see it
  appear in history with a pending state.
- **Boundary:** `components/ai/`.
- **Depends on:** Unit 7 (editor with a canvas to sit beside).
- **Notes:** Split from the backend (Unit 12) per `ai-workflow-rules.md`.

### Unit 12 — AI generation backend (Trigger.dev + Gemini) + node spawning
- **Builds:** A Server Action that hands the prompt to a Trigger.dev job and
  returns a job id; the job calls Google Gemini with structured output; the
  returned JSON is Zod-validated against the Unit 8 node schema; the client
  consumes the completed job and spawns the nodes into their swimlanes
  (append-only).
- **Visible result:** Type "Add an API Gateway, User Service, and Postgres DB"
  → nodes spawn into the correct swimlanes within seconds, with no UI freeze.
- **Boundary:** `trigger/` (job + LLM call) + the Server Action handoff in
  `app/`; client-side spawn reuses Unit 8.
- **Depends on:** Unit 8 (node schema + swimlane helper), Unit 11 (sidebar to
  submit from and show status).
- **Introduces (just in time):** Trigger.dev SDK, Google Gemini SDK, Zod
  schema for the AI payload.
- **Invariants enforced:** no synchronous LLM call in a Server Action;
  AI is strictly append-only (never mutates/deletes existing nodes/edges).

### Unit 13 — Liveblocks multiplayer sync
- **Builds:** Liveblocks room config, connection hooks, and real-time sync of
  nodes/edges plus live cursor tracking, in `lib/liveblocks/`.
- **Visible result:** Open the same board in two windows → moving/adding a node
  in one appears in the other in real time, with a visible remote cursor.
- **Boundary:** `lib/liveblocks/` (+ minimal canvas wiring).
- **Depends on:** Unit 7 (canvas), Unit 8 (node state to sync).
- **Introduces (just in time):** `@liveblocks/client` / `@liveblocks/react`.
- **Invariant enforced:** during an active session Liveblocks is the single
  source of truth for canvas state.

### Unit 14 — Revocable share links (view / edit)
- **Builds:** A `ShareLink` model (random token, `projectId`, role `VIEW|EDIT`,
  `revokedAt`), a **Share** dialog where the owner picks a role and gets a
  `/share/[token]` link (and can revoke existing links), a public
  `/share/[token]` route that resolves an active token to the board, and the
  Liveblocks access token that admits the guest anonymously at the link's role
  (EDIT = full edit, VIEW = read-only). Only the authenticated owner can
  generate/revoke links or delete the board.
- **Visible result:** Owner opens Share → picks "can edit" → copies the link →
  opens it in an incognito window → the guest edits in real-time; owner clicks
  Revoke → the incognito window loses access.
- **Boundary:** `app/` (share route + Server Actions), `prisma/` (ShareLink
  model + migration), `lib/liveblocks/` (guest room auth token).
- **Depends on:** Unit 13 (real-time engine), Unit 7 (board route), Unit 6
  (owner-scoped Server Action pattern).
- **✅ Decision resolved:** the board id is **not** a public entry point;
  anonymous access is only via an active share **token**. The `/share/[token]`
  route opts out of `auth.protect()`; the token's role gates VIEW vs EDIT in
  the Liveblocks auth endpoint. Reconciled in `architecture.md` /
  `project-overview.md`.

### Unit 15 — Persistence integration (autosave + flush + load-into-room)
- **Builds:** Load the persisted Postgres snapshot into the Liveblocks room on
  open, and flush Liveblocks state back to the Postgres JSONB column on
  explicit save and on an autosave interval; the top-bar save-status indicator
  reflects saved / pending / error.
- **Visible result:** Edits made collaboratively auto-save; reopening the board
  (or a guest rejoining later) shows the last persisted state, and the status
  indicator shows "Saved".
- **Boundary:** `app/` (save Server Action) + `lib/liveblocks/`.
- **Depends on:** Unit 13 (Liveblocks as session source of truth), Unit 7
  (snapshot save/load Server Action to extend).
- **Autosave (resolved):** debounced only — flush ~2s after editing stops; no
  fixed-interval cap. Manual Save triggers an immediate flush.
- **Notes:** Completes the storage loop: Liveblocks = live state, Postgres =
  persistent snapshot only.

### Unit 16 — Guest disconnect / AI failure fallback hardening
- **Builds:** Graceful fallback UI for the two external-failure paths named in
  `code-standards.md`: AI generation failure (Gemini/Trigger.dev error) and
  Liveblocks disconnect/reconnect, plus save-failure surfacing.
- **Visible result:** Kill the network → the canvas shows a clear
  "reconnecting" / "generation failed, retry" state instead of a crash.
- **Boundary:** `components/ai/`, `components/canvas/`, `lib/liveblocks/`.
- **Depends on:** Units 12, 13, 15 (the failure sources must exist to handle).
- **Notes:** Small but distinct visible result; folds the scattered
  error-handling requirements into one hardening pass rather than sprinkling
  them across earlier units.

---

## Success-criteria coverage map

Confirms every `project-overview.md` success criterion is delivered by a unit:

1. Signed-in user creates a board & saves empty state → **Units 6 + 7**.
2. Prompt spawns valid nodes in correct swimlanes → **Units 8 + 12**.
3. Draw an edge and assign protocol/API-route metadata → **Unit 9**.
4. Guest opens shared link in incognito and edits in real-time → **Units 13 + 14**.

---

## Resolved decisions (all three flagged items closed)

- **Canvas storage (Unit 7):** added a `canvas` JSONB column, dropped
  `canvasJsonPath` (migration `canvas_jsonb`); matches `architecture.md`
  invariant #4. `05-prima.md` marked superseded on that field.
- **Guest access (Unit 14):** revocable **share tokens** with a per-link role
  (VIEW / EDIT), owner-revocable. The board id is never the public entry point;
  anonymous access is only via `/share/[token]`. Adds a `ShareLink` model.
  Reflected in `architecture.md` and `project-overview.md`.
- **Autosave cadence (Unit 15):** debounced only — flush Liveblocks → Postgres
  ~2s after editing stops (no fixed-interval cap). Manual Save = immediate
  flush.
