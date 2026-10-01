# Unit 14: Revocable Share Links (view / edit)

## Goal

Let a board owner mint unguessable `/share/[token]` links with a per-link
role (`VIEW` or `EDIT`), hand them to anonymous guests who join the live
Liveblocks session with no account, and revoke any link at any time to cut
off access immediately. The board id is never a public entry point —
anonymous access is granted **only** through an active share token.

## Design

Mostly backend + one new dialog and one new public route. No new design
tokens. The Share control reuses the existing navbar `actionsSlot` and the
`DialogPattern` wrapper (Unit 2 / Unit 4). The public guest view reuses the
exact board chrome and canvas, gated down to the link's role.

### Share dialog

Owner-only. A `Share2` (Lucide) ghost icon button sits in the board navbar
`actionsSlot`, left of the AI toggle. It opens a modal (`--bg-elevated`,
`rounded-lg`, `backdrop-blur-sm`, `z-50` per `ui-context.md`) containing:

- A short heading ("Share this board") and one-line explanation that
  anyone with the link can view or edit without an account.
- A **role segmented control** — two `Button`s ("Can view" / "Can edit"),
  same segmented-control pattern as the edge property panel in Unit 9
  (active = default/accent variant, `aria-pressed`). Defaults to **Can
  edit** (matches the headline success criterion: a guest editing in an
  incognito window).
- A **Create link** button. On success a new row appears in the list below.
- A **list of existing active links** for this board: each row shows the
  role badge, the full `/share/[token]` URL in `--font-mono` `text-xs`
  (truncated with `title`), a **Copy** button (`Copy` icon → `Check` for
  ~1.5s on success, via the Clipboard API), and a **Revoke** button
  (`Trash2`, `--state-error` on hover). Revoked links are not listed.
- Empty state when no active links exist ("No active links yet").

The dialog surfaces an inline `role="alert"` error line on action failure
(same convention as the project dialogs).

### Guest view (`/share/[token]`)

A guest opening an active link lands on the same full-viewport board layout
— navbar + canvas + cursors — but **stripped of owner-only chrome**:

- No Share button, no AI sidebar/toggle, no project sidebar, no Clerk
  `UserButton` (there is no Clerk session). The navbar shows the board
  title, a small **"Shared · view"** / **"Shared · edit"** role pill, and a
  "Sign in" link to the marketing `/` for context.
- **EDIT guests** get the full interactive canvas (add/move/delete nodes,
  draw/edit edges, group) synced through Liveblocks exactly like the owner,
  **but no Save button** — persistence to Postgres stays owner-scoped
  (Unit 15 autosaves from the owner's client; see the decision note below).
- **VIEW guests** get a read-only canvas: `nodesDraggable={false}`,
  `nodesConnectable={false}`, `elementsSelectable={false}`,
  `edgesFocusable={false}`, no add-node toolbar, no property panel editing.
  They still see live updates and remote cursors (presence), and broadcast
  their own cursor.

A revoked, unknown, or malformed token renders a simple centered
"This link is no longer active" state (reusing the `RoomMessage` visual
language from `room-provider.tsx`), **not** `notFound()` — the distinction
between "revoked" and "never existed" is deliberately not leaked.

## Implementation

### 1. Prisma — `ShareLink` model + migration

Add to `prisma/models/project.prisma` (new enum + model, and a back-relation
on `Project`):

```prisma
enum ShareRole {
  VIEW
  EDIT
}

model ShareLink {
  id        String    @id @default(cuid())
  token     String    @unique
  projectId String    @map("project_id")
  role      ShareRole @default(EDIT)
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@map("share_links")
}
```

Add `shareLinks ShareLink[]` to the `Project` model. An **active** link is
`revokedAt == null`. Revoking is a soft delete (set `revokedAt = now()`),
so an old URL stays dead even if the same random bytes recur (they won't,
but soft-delete also preserves an audit trail and keeps `token` unique).

**Migration:** generate the SQL with `prisma migrate diff` and apply it the
same hand-written way Unit 6 did (`prisma migrate dev` prompts
interactively and can't run in this non-interactive shell) — write the
migration file under `prisma/migrations/`, apply with `migrate deploy`,
then `prisma generate`. Do not edit existing migrations (protected).

### 2. Token generation — `lib/share.ts` (new)

A pure helper module (no Prisma, importable by client for the URL builder):

- `createShareToken(): string` — `crypto.randomBytes(24).toString("base64url")`
  (32 url-safe chars, ~192 bits). Node `crypto`, no new dependency.
- `shareUrl(token: string): string` — builds `/share/${token}` (path only;
  callers prefix with `window.location.origin` for copy).
- `SHARE_TOKEN_COOKIE = "archboard_share_token"` constant, shared by the
  guest route and the Liveblocks auth endpoint.

### 3. Share Server Actions — `app/editor/[projectId]/share-actions.ts` (new, `"use server"`)

Three owner-scoped actions, each following the established pattern: resolve
Clerk `userId` (reject if signed out), Zod-validate input, verify ownership
with an owner-scoped Prisma query **before** any mutation, return
`{ ok: true, ... } | { ok: false, error }` (never throw), log real errors
server-side and return a generic message.

- `createShareLink(input)` — input `{ projectId, role: "VIEW" | "EDIT" }`.
  Verify `project.findFirst({ where: { id, ownerId: userId } })`; if missing
  return "Project not found." Create a `ShareLink` with a fresh token; retry
  once on a `P2002` token collision. Return `{ ok: true, link }` where
  `link` is the serialized row (id, token, role, createdAt).
- `revokeShareLink(input)` — input `{ projectId, linkId }`. Owner-scoped
  `updateMany({ where: { id: linkId, project: { id: projectId, ownerId:
  userId }, revokedAt: null }, data: { revokedAt: new Date() } })`. A
  `count === 0` result is a benign "Link not found." no-op (another user's
  id or an already-revoked link).
- `listShareLinks(projectId)` — owner-scoped read returning active links
  (`revokedAt: null`, newest first) for the dialog's initial render. May
  also be fetched in the board page's Server Component and passed as a prop.

No `revalidatePath` on the board route (same reasoning as `saveCanvas` —
it would clobber live canvas state). The dialog updates its own list
optimistically from the action result.

### 4. Share dialog UI — `components/editor/share-dialog.tsx` (new, `"use client"`)

Composes `DialogPattern`. Owns local state: selected role, the links list
(seeded from a prop, mutated on create/revoke), per-row copy/revoke pending
flags, and an error string. Uses `useTransition` for action calls (same as
`use-project-dialogs.ts`). Copy uses `navigator.clipboard.writeText` with
the absolute URL (`window.location.origin + shareUrl(token)`); fall back to
selecting the text if the Clipboard API rejects.

Wire it from `board-editor.tsx` (owner path only): add a `Share2` button to
`navbarActions` and render `<ShareDialog>` controlled by local `shareOpen`
state. Pass the owner's initial active links down from the board page.

### 5. Public guest route — `app/share/[token]/page.tsx` (new)

A Server Component that **does not** call `auth.protect()` (this is the one
anonymous entry point):

1. Await `params.token`.
2. `prisma.shareLink.findFirst({ where: { token, revokedAt: null }, select:
   { role: true, project: { select: { id, name, canvas } } } })`.
3. If no active link → render the "link no longer active" state.
4. Set the share-token cookie so the Liveblocks auth endpoint can authorize
   this guest: `(await cookies()).set(SHARE_TOKEN_COOKIE, token, { httpOnly:
   true, sameSite: "lax", secure: true, path: "/" })`. (A Server Component
   can set cookies in Next 16 via the async `cookies()` API; if the runtime
   rejects a write during render, move this to a tiny Route Handler the
   guest page redirects through, or a `middleware`/`proxy.ts` rule — note
   the fallback in the spec and pick during implementation.)
5. Render `<BoardEditor>` in guest mode (see §7), passing `projectId`,
   `projectName`, `parseCanvas(project.canvas)`, the link `role`, and
   `access: role === "EDIT" ? "edit" : "view"`.

> **Decision (flag for review):** the guest's token reaches the Liveblocks
> auth endpoint via an **httpOnly cookie** set by this route, so the static
> `authEndpoint: "/api/liveblocks-auth"` in `liveblocks.config.ts` needs no
> change. The alternative is converting `authEndpoint` to a callback that
> posts the token in the body. Cookie chosen because it keeps the single
> auth endpoint and avoids threading the token through the client. If you
> prefer the callback form, say so and §6 changes accordingly.

### 6. Liveblocks auth endpoint — extend `app/api/liveblocks-auth/route.ts`

Keep the existing owner path; add a guest branch:

- If Clerk `userId` **is** present → current behavior (owner-scoped project
  lookup → `room:write`), unchanged.
- If **no** `userId`:
  1. Read the `SHARE_TOKEN_COOKIE` from the request. Missing → 401.
  2. Look up `shareLink.findFirst({ where: { token, revokedAt: null },
     select: { role, projectId } })`. Missing → 403 (covers revoked).
  3. Verify `shareLink.projectId === room` (the room the client is joining).
     Mismatch → 403.
  4. Mint a Liveblocks token via the existing `POST /v2/authorize-user`
     call with:
     - `userId: "guest_" + crypto.randomUUID()` (anonymous, unique per
       session so cursors don't collide),
     - `userInfo: { name: "Guest" }`,
     - `permissions: { [room]: role === "EDIT" ? ["room:write"] :
       ["room:read", "room:presence:write"] }` — VIEW can read storage and
       broadcast its cursor, but cannot mutate storage.

Because a revoked link fails the lookup, a guest who is mid-session loses
the ability to **re-auth**; Liveblocks drops them on the next token refresh
/ reconnect. To cut access promptly on revoke, the owner's revoke action
should additionally be documented as "guest is evicted on reconnect"
(hard, immediate server-side eviction via the Liveblocks REST API is
out of scope for this unit — note it as a follow-up if instant kick is
required).

### 7. Guest mode in `board-editor.tsx`

Add an `access` prop: `"owner" | "edit" | "view"` (default `"owner"` so the
existing owner page is unchanged).

- `access === "owner"`: everything as today (Save, Share, AI sidebar,
  project sidebar).
- `access === "edit"`: render the interactive canvas + add-node toolbar +
  property panel + cursors, but **omit** Save, Share, AI, and the project
  sidebar. The navbar shows the title + role pill + Sign-in link instead of
  the project-sidebar toggle and `UserButton`.
- `access === "view"`: as `edit` but pass the read-only React Flow flags
  (§Design) to `BoardCanvas`, and omit the add-node toolbar and property
  panel. Cursors and live updates still render.

Guest mode must not import or mount owner-only Server Action callers (the
AI sidebar's `generateNodes` and the project dialogs), so no owner data
leaks and no action 401s. Extract the guest-safe navbar into a small
variant or branch inside `BoardEditorInner`. `EditorShell` currently always
renders the project sidebar + dialogs; for guests, either pass empty lists
and hide the toggle, or render a lighter guest chrome — pick the smaller
diff during implementation and record it.

### 8. Marketing page unaffected

`/` and `auth.protect()` behavior is unchanged. The only new unauthenticated
surface is `/share/[token]` and the already-public
`/api/liveblocks-auth` (which now authorizes guests only via the cookie).

## Dependencies

- None new. Token generation uses Node's built-in `crypto`; cookies use
  Next's built-in `next/headers`. (`@liveblocks/client` / `@liveblocks/react`
  and `zod` are already installed.)

## Verify when done

- [ ] Owner opens Share, sees the dialog with role control and an empty
      link list
- [ ] Creating a "Can edit" link adds a row with a copyable
      `/share/[token]` URL; Copy puts the absolute URL on the clipboard
- [ ] Opening the link in an incognito window (no account) loads the board
      and the guest can add/move/delete nodes and edges in real time
- [ ] A second window (owner) sees the guest's edits live, and the guest
      sees the owner's — with both cursors labeled ("Guest" for the guest)
- [ ] A "Can view" link loads read-only: the guest cannot drag, connect,
      select, or add nodes, but sees live updates and cursors
- [ ] Clicking Revoke on a link removes it from the list; the incognito
      guest loses access on reconnect / token refresh
- [ ] A revoked or bogus `/share/[token]` shows "link no longer active",
      never the board and never a crash
- [ ] A guest cannot reach the board by its raw `/editor/[projectId]` URL
      (still `notFound()` / owner-scoped)
- [ ] A non-owner (different signed-in account) cannot create or revoke
      links for someone else's board
- [ ] Guest view shows no Share, AI, project sidebar, or UserButton
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No console errors
- [ ] Responsive at mobile and desktop
- [ ] `npm run build` passes
