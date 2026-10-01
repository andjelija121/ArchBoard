# Unit 13: Liveblocks Multiplayer Sync

## Goal

Wire Liveblocks into the board canvas so that two or more browser windows
viewing the same project see real-time node/edge changes and live cursors.
During an active session Liveblocks becomes the single source of truth for
canvas state (architecture invariant #3), replacing the local
`useNodesState`/`useEdgesState` in `board-editor.tsx` with Liveblocks
storage-backed state that syncs across all connected clients.

## Design

This unit is mostly invisible infrastructure — its visible result is
**multiplayer**: open the same board in two windows and see changes
propagate instantly, with colored cursors showing each participant's
pointer position. No new UI components, chrome, or tokens are introduced
beyond the cursor overlay.

### Live cursors

Each connected user broadcasts their pointer position via Liveblocks
Presence. A `<Cursors />` overlay renders colored pointers on top of the
canvas (inside the React Flow viewport coordinate space so they move with
pan/zoom). Each cursor shows a small name label — the authenticated
owner's first name (from Clerk), or "Guest" for anonymous users (who
arrive in Unit 14). Colors are assigned round-robin from a fixed 6-color
palette (reuse the `--group-*` tokens: slate, cyan, amber, green, purple
plus `--accent-primary` as a sixth) keyed by Liveblocks `connectionId`
to stay stable for the duration of a session.

### Storage shape

Liveblocks Storage holds the authoritative canvas state in two
`LiveList` fields:

```
Storage {
  nodes: LiveList<LiveObject<BoardNode>>
  edges: LiveList<LiveObject<BoardEdge>>
}
```

Each element is a `LiveObject` so individual field mutations (e.g. moving
a single node) are fine-grained — Liveblocks only sends the changed
fields, not the entire array.

### Presence shape

```
Presence {
  cursor: { x: number; y: number } | null   // canvas-space pointer
  name: string                                // display name
  color: string                               // hex from cursor palette
}
```

### Room identity

Each board maps to one Liveblocks room. The room ID is the project ID
(`project.id`). The Liveblocks auth endpoint mints a token scoped to
that room with the user's identity (Clerk `userId` + first name for
owners; anonymous guests use a Liveblocks anonymous token — wired in
Unit 14). For now (before Unit 14), only the authenticated owner can
join, so the auth endpoint verifies Clerk auth and returns a token with
`userId` and `userInfo: { name }`.

### How it replaces local state

Today `board-editor.tsx` owns nodes/edges via React Flow's
`useNodesState`/`useEdgesState`, which are purely local. This unit
replaces that with Liveblocks-backed hooks that:

1. **Initialize** Storage from the Postgres snapshot on first room join
   (if Storage is empty — i.e. no other client has already loaded this
   room). If Storage already has data (another client is connected),
   the joining client receives the live state, not the DB snapshot.
2. **Sync** every local mutation (node move, edge add, property edit,
   group creation) to all connected clients in real time.
3. **Read** from Storage on every render, so the canvas is always the
   consensus view.

The save-to-Postgres flow (Unit 07's `saveCanvas` Server Action) stays
unchanged — it serializes the current Storage snapshot to the DB on
manual save. Autosave (Unit 15) will later wrap this in a debounce.

## Implementation

### 1. Dependencies

Install **`@liveblocks/client`** and **`@liveblocks/react`** (the React
bindings). These are the two packages listed in the build plan.

No `@liveblocks/node` is needed — the auth endpoint is a plain Next.js
route that calls the Liveblocks REST API with the project's secret key.

### 2. Liveblocks config — `liveblocks.config.ts` (root)

Define the TypeScript types for the Liveblocks room using
`createClient` from `@liveblocks/client`:

```ts
import { createClient } from "@liveblocks/client"

export const liveblocksClient = createClient({
  authEndpoint: "/api/liveblocks-auth",
})
```

Export the typed hooks via `createRoomContext` from `@liveblocks/react`:

```ts
import { createRoomContext } from "@liveblocks/react"

type Presence = {
  cursor: { x: number; y: number } | null
  name: string
  color: string
}

type Storage = {
  nodes: LiveList<LiveObject<BoardNode>>
  edges: LiveList<LiveObject<BoardEdge>>
}

export const {
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
  useStorage,
  useMutation,
  useSelf,
} = createRoomContext<Presence, Storage>(liveblocksClient)
```

### 3. Liveblocks auth endpoint — `app/api/liveblocks-auth/route.ts`

A POST route handler:

1. Call `await auth()` from `@clerk/nextjs/server` to get `userId`.
2. If no `userId`, return 401 (anonymous guests are handled in Unit 14).
3. Look up the user's name from Clerk (`currentUser()` → `firstName`
   or fallback to "User").
4. Read `room` from the request body (Liveblocks sends it automatically).
5. Verify the user has access to this room/project:
   - Query Prisma for a project where `id === room` and
     `ownerId === userId`. If not found, return 403.
   - (Unit 14 will extend this to also allow guests with an active
     share token.)
6. Use the **Liveblocks REST API** (`POST https://api.liveblocks.io/v2/rooms/{roomId}/authorize`)
   with `LIVEBLOCKS_SECRET_KEY` to generate a session token, passing
   `userId` and `userInfo: { name }`.
7. Return the token response (status and body) to the client.

**Environment variable:** `LIVEBLOCKS_SECRET_KEY` (added to `.env.local`).

### 4. Room provider wrapper — `lib/liveblocks/room-provider.tsx`

A `"use client"` component that wraps children in `<RoomProvider>`:

```tsx
"use client"

import { RoomProvider } from "@/liveblocks.config"
import { LiveList, LiveObject } from "@liveblocks/client"
import type { CanvasSnapshot } from "@/lib/canvas"

interface LiveRoomProps {
  roomId: string
  initialSnapshot: CanvasSnapshot
  children: React.ReactNode
}

export function LiveRoom({ roomId, initialSnapshot, children }: LiveRoomProps) {
  return (
    <RoomProvider
      id={roomId}
      initialPresence={{ cursor: null, name: "", color: "" }}
      initialStorage={{
        nodes: new LiveList(
          initialSnapshot.nodes.map((n) => new LiveObject(n))
        ),
        edges: new LiveList(
          initialSnapshot.edges.map((e) => new LiveObject(e))
        ),
      }}
    >
      {children}
    </RoomProvider>
  )
}
```

`initialStorage` is only used when the room has no existing Storage
(first client to connect). If another client is already connected,
Liveblocks ignores `initialStorage` and syncs the live state instead.

### 5. Canvas state hooks — `lib/liveblocks/use-live-canvas.ts`

A custom hook that bridges Liveblocks Storage with React Flow's expected
API shape. It replaces `useNodesState`/`useEdgesState` in
`board-editor.tsx`:

```ts
export function useLiveCanvas()
```

Returns:
- `nodes: BoardNode[]` — derived from `useStorage` reading the
  `nodes` LiveList.
- `edges: BoardEdge[]` — derived from `useStorage` reading the
  `edges` LiveList.
- `onNodesChange(changes)` — applies React Flow node changes
  (position, dimensions, selection, remove, add) to Storage via
  `useMutation`. Position changes update the corresponding
  `LiveObject` in-place. Removes splice the item from the `LiveList`.
  Selection and dimension-only changes are local-only (not synced to
  Storage — selection is per-user, and dimension is a React Flow
  measurement artifact).
- `onEdgesChange(changes)` — same pattern for edges.
- `setNodes(updater)` — for imperative updates (group creation, AI
  spawn). Replaces the full `nodes` LiveList content.
- `setEdges(updater)` — same for edges.
- `addEdge(edge)` — pushes a new edge `LiveObject` onto the
  `edges` LiveList.

**Dirty tracking:** the hook accepts an `onMutate` callback that
`board-editor.tsx` passes to `markDirty()`. It is called on any
non-select, non-dimension-only change — same filtering logic as the
current `handleNodesChange`/`handleEdgesChange`.

### 6. Cursor broadcasting — `lib/liveblocks/use-live-cursors.ts`

```ts
export function useLiveCursors()
```

Uses `useUpdateMyPresence` to broadcast the local pointer on
`onPointerMove` inside the React Flow viewport. The position must be
converted from screen space to canvas (flow) space using React Flow's
`screenToFlowPosition`. Returns:

- `onPointerMove(event)` — handler to attach to the React Flow wrapper.
- `onPointerLeave()` — sets `cursor: null` in presence.

On mount, sets `name` and `color` in presence (derived from the auth
endpoint's `userInfo` via `useSelf`, with color from `connectionId`).

### 7. Cursor overlay — `components/canvas/cursors.tsx`

A presentational component that renders other users' cursors on the
canvas:

```tsx
export function Cursors()
```

Uses `useOthers` to read all other users' presence. For each user with
a non-null `cursor`:

- Renders an SVG arrow pointer at `(cursor.x, cursor.y)` in canvas
  space, colored with the user's `presence.color`.
- Below the arrow, a small pill label (`text-xs rounded-sm px-1.5 py-0.5`)
  showing `presence.name`, background matching the cursor color.
- The whole element uses `pointer-events-none` so it doesn't interfere
  with canvas interactions.
- Positioned via `style={{ transform: translate(x, y) }}` — the
  component sits inside `<ReactFlow>` as a child so it moves with
  pan/zoom automatically.

**Z-index:** cursors render at `z-30` (above nodes at `z-20`, below
the sidebar/panel at `z-40`).

### 8. Wiring into `board-editor.tsx`

Replace the current local state management:

1. **Wrap** `BoardEditor` in `<LiveRoom>` (above `ReactFlowProvider`),
   passing `roomId={projectId}` and `initialSnapshot`.
2. **Replace** `useNodesState`/`useEdgesState` with `useLiveCanvas()`.
3. **Replace** the direct `onNodesChange`/`onEdgesChange` wrappers with
   the hook's versions (which already handle dirty tracking via the
   `onMutate` callback, and sync to Storage).
4. **Replace** `setNodes`/`setEdges` calls in `handleAddNode`,
   `handleGroup`, `handleSpawnResult`, `handleNodeDrag`, `onConnect`,
   `clearSelection`, `updateEdgeData`, `updateNodeData`,
   `updateGroupData`, and `ungroup` with the hook's `setNodes`/`setEdges`
   (which write to Storage).
5. **Add** `useLiveCursors()` and attach `onPointerMove`/`onPointerLeave`
   to the React Flow container.
6. **Render** `<Cursors />` as a child of `<ReactFlow>` (children of
   ReactFlow are rendered in the viewport coordinate space).
7. **Save** still calls `saveCanvas` with `{ nodes, edges }` read from
   the hook — same Server Action, same Prisma write.

### 9. Board page update — `app/editor/[projectId]/page.tsx`

The page already loads the Postgres snapshot. It continues to pass
`initialSnapshot` to `BoardEditor`, which now forwards it to
`<LiveRoom>` as the Storage seed.

No changes to the page's Server Component logic. `auth.protect()` and
the owner-scoped Prisma query remain — guest access is Unit 14.

### 10. Group-before-child array ordering

Liveblocks `LiveList` preserves insertion order. The existing convention
— group nodes prepended, smart nodes appended — is maintained by
`setNodes` writing groups first. `zIndex: -1` on boxes ensures they
render behind members regardless, but consistent ordering avoids visual
flicker on initial load.

`childIds` in group data can go stale if a member is deleted by another
client. This is harmless: drag propagation only matches IDs that still
exist in the node array, and `computeGroupBounds` silently ignores
missing members. (Note from Unit 10 progress tracker entry.)

## Dependencies

- `@liveblocks/client` (real-time client SDK — WebSocket transport,
  Storage, Presence)
- `@liveblocks/react` (React hooks for Storage, Presence, room
  connection)

## Verify when done

- [ ] Open the same board in two browser windows — adding a node in
      one window appears in the other within ~1 second
- [ ] Moving a node in one window updates its position in the other
- [ ] Deleting a node/edge in one window removes it in the other
- [ ] Drawing a new edge in one window appears in the other
- [ ] Editing edge properties (protocol, API route) in one window
      updates the other
- [ ] Renaming a node or group in one window updates the other
- [ ] Creating a bounding box group in one window appears in the other
- [ ] AI-generated nodes spawned in one window appear in the other
- [ ] Live cursors: moving the mouse in one window shows a colored
      cursor with a name label in the other
- [ ] Cursor disappears when the pointer leaves the canvas or the
      window is closed
- [ ] Manual Save in either window persists the current state to
      Postgres — reload shows the saved state
- [ ] Closing one window does not affect the other's canvas state
- [ ] A second window joining an already-open room receives the live
      state (not the stale DB snapshot)
- [ ] Group drag propagation works across clients: dragging a box in
      one window moves its children in the other
- [ ] Property panel in each window reflects the other's edits after
      selecting the same element
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No console errors
- [ ] Responsive at mobile and desktop
- [ ] `npm run build` passes
