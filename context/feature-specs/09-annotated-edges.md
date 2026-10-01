# Unit 09: Annotated Edges + Shared Property Panel (Edges + Nodes)

## Goal

Add a custom annotated edge type and a single right-anchored property
panel that opens when an edge **or** a node is clicked. Clicking an edge
lets the user set its protocol (REST / gRPC / WebSocket), sync/async
behavior, primary API route, and a load estimate — and the edge label
on the canvas updates live. Clicking a node lets the user rename it and
set its sub-label. The panel is one shell that switches its body on the
selected element's kind.

> **Scope note.** This unit resolves the open question in
> `progress-tracker.md` (line 162 — "where node renaming lives"): it
> lives here, in the shared property panel. No later unit (10 bounding
> boxes, 11–12 AI, 13–16 multiplayer/sharing/persistence) naturally
> owns node editing, so Unit 09 — which already builds the exact panel
> infrastructure — absorbs it. The build-plan "edge property panel"
> line is widened to "selection property panel"; the visible result is
> unchanged in spirit (select an element → edit its properties in a
> side panel).

## Design

Visual decisions follow `ui-context.md`. The panel is chrome, so it uses
**only** chrome tokens — the `--node-*` palette never appears in it
(invariant in `ui-context.md`), except the small category icon on the
node-panel header, which is already allowed inside `components/canvas/`.

### Property panel (shared shell)

- **Placement & surface** (`ui-context.md` → *Layout Patterns* →
  *Property panels*): anchored right, `--bg-surface`, single **left**
  border, no elevation/shadow. It slides in over the canvas when an
  element is selected and is removed when selection clears.
- **Dimensions:** full board-area height, fixed width `w-80` (320px) —
  mirrors the project sidebar's `w-80 border-border bg-card`
  (`components/editor/project-sidebar.tsx:49`), so no arbitrary
  `w-[...]` value is introduced (`code-standards.md` → *Styling*).
- **Layer:** `z-40` — the "AI chat sidebar / property panel" layer in
  `ui-context.md` → *Z-Index Hierarchy*. Below modals (`z-50`), above
  the add-node toolbar (`z-30`) and the canvas (`z-0`).
- **Structure:**
  - **Header row:** a title (`text-base font-semibold text-foreground`,
    the *Panel heading* scale) describing the selection ("Edge" /
    "Node" or the category label), plus a ghost `Button` with the
    Lucide `X` icon (`h-4 w-4`, 1.5 stroke) aligned right that clears
    the selection. `border-b border-border` under the header.
  - **Body:** a `ScrollArea` (shadcn primitive, already present) holding
    the field groups, `p-4 flex flex-col gap-4`.
- **Field label style:** a plain `<label>` per field —
  `text-xs font-medium text-muted-foreground`. (No shadcn `Label`
  primitive exists; don't add one.)
- **Entrance:** `translate-x-full → translate-x-0` with
  `transition-transform duration-200` (matches the sidebar's
  `duration-200`), so it reads as a slide-in, not a pop.

### Annotated edge (canvas)

- **Path:** `getSmoothStepPath` — orthogonal right-angle routing reads
  as a schematic/architecture connector, consistent with the
  "technical workspace" language in `ui-context.md`. Rounded corners via
  the default `borderRadius`.
- **Stroke color — chrome, not node palette.** Saturated color is
  reserved for accent and node identity (`ui-context.md` → *Theme*), so
  the protocol does **not** recolor the edge. Resting edge =
  `var(--border-strong)` (`#3f3f46`); selected edge =
  `var(--accent-primary)` (`#22d3ee`) at `strokeWidth: 2`. This matches
  the canvas selection convention already set for nodes
  (`--xy-selection-border` → accent) and the connection line
  (`react-flow-overrides.css`).
- **Sync vs async = line style, not color.** Sync = solid stroke; async
  = dashed (`strokeDasharray: "6 4"`). One glance distinguishes a
  blocking call from a fire-and-forget one without spending a hue.
- **Arrowhead:** `MarkerType.ArrowClosed`, colored to match the current
  stroke (resting vs selected), pointing at the target handle (edges
  flow source-right → target-left, matching the Unit 08 handles).
- **Edge label badge** (`ui-context.md` → *Edge label* = `text-xs
  font-mono`; *Border Radius* → edge labels = `rounded-sm` 2px):
  - A small pill rendered via `EdgeLabelRenderer` at the path midpoint:
    `rounded-sm border border-border bg-card px-1.5 py-0.5 text-xs
    font-mono text-foreground`, `pointer-events: all`, plus the
    `nodrag nopan` classes so clicking it doesn't pan the canvas.
  - **Content:** the protocol label (`REST` / `gRPC` / `WebSocket`).
    When `apiRoute` is set, it's shown on a second line
    (`text-text-subtle`, truncated with a `max-w` cap) under the
    protocol. The label is always present (protocol defaults to REST),
    so a freshly drawn edge is immediately annotated.
  - Clicking the badge selects the edge and opens the panel (same as
    clicking the edge path).

### Node property panel body

- Header shows the category icon (`CATEGORY_ICON[category]`, `h-4 w-4`,
  colored with `CATEGORY_STYLE[category].icon` — the one place the node
  palette is allowed) + the category label.
- **Label** field → shadcn `Input`, maps to `data.label`.
- **Sub-label** field → shadcn `Input` with `font-mono` (sub-labels are
  identifiers like `postgres`, `nginx`, per Unit 08), maps to
  `data.subLabel`. Empty input clears `subLabel` back to `undefined`.

## Implementation

### 1. `lib/canvas.ts` — edge schema, protocol enum, helpers

Extend the existing shared module (it already owns `BoardEdge`,
`canvasSnapshotSchema`, the node schema, and `createNodeId`). Keep
`edgeSchema` inside `canvasSnapshotSchema` **loose** — exactly as the
node schema stayed loose in Unit 08. Edge `data` and `type` survive the
round-trip because `z.looseObject` preserves unknown keys; validation of
the annotated shape happens at the render boundary (§2), not in the
board-wide schema.

Add:

```ts
export const EDGE_PROTOCOLS = ["rest", "grpc", "websocket"] as const
export type EdgeProtocol = (typeof EDGE_PROTOCOLS)[number]

export const PROTOCOL_LABEL: Record<EdgeProtocol, string> = {
  rest: "REST",
  grpc: "gRPC",
  websocket: "WebSocket",
}

export const ANNOTATED_EDGE_TYPE = "annotated"

/** The `data` payload of every annotated edge. Validated at render time. */
export const annotatedEdgeDataSchema = z.object({
  protocol: z.enum(EDGE_PROTOCOLS).default("rest"),
  async: z.boolean().default(false),
  apiRoute: z.string().max(120).optional(),
  loadEstimate: z.string().max(80).optional(),
})
export type AnnotatedEdgeData = z.infer<typeof annotatedEdgeDataSchema>

/** Default data for a newly drawn edge. */
export const DEFAULT_EDGE_DATA: AnnotatedEdgeData = {
  protocol: "rest",
  async: false,
}

export function createEdgeId(): string {
  return `e_${crypto.randomUUID()}`
}
```

Notes:
- `annotatedEdgeDataSchema` mirrors `smartNodeDataSchema` from Unit 08:
  a tight, Zod-inferred type validated where the data is consumed, while
  the persisted board schema stays permissive.
- `.default()` on `protocol`/`async` means a legacy edge whose `data`
  is missing those keys still parses to a usable annotated edge.
- `createEdgeId` prefixes `e_` so edge ids are distinguishable from
  node ids (`n_`) in JSON dumps — same rationale as `createNodeId`.

### 2. `components/canvas/edges/annotated-edge.tsx` — custom edge

New file, `"use client"`. One component registered for the `annotated`
edge type.

- Import `{ BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
  type EdgeProps }` from `@xyflow/react`.
- Validate `data` at the boundary (same pattern as `SmartNode`):
  ```ts
  function AnnotatedEdgeBase(props: EdgeProps) {
    const { sourceX, sourceY, targetX, targetY,
            sourcePosition, targetPosition, markerEnd, selected } = props
    const parsed = annotatedEdgeDataSchema.safeParse(props.data)
    const data = parsed.success ? parsed.data : DEFAULT_EDGE_DATA
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    })
    // stroke / dash from selected + data.async (see Design)
    // ...
  }
  export const AnnotatedEdge = React.memo(AnnotatedEdgeBase)
  ```
  `safeParse` failing never crashes the canvas — it falls back to
  defaults (matches `code-standards.md`: validate unknown input at the
  boundary; here the boundary is the render step).
- Render `<BaseEdge path={path} markerEnd={markerEnd} style={{ stroke,
  strokeWidth, strokeDasharray }} />` where `stroke` is
  `var(--accent-primary)` when `selected` else `var(--border-strong)`,
  `strokeWidth` 2 when selected else 1.5, and `strokeDasharray` is
  `"6 4"` when `data.async` else undefined.
- Render the label badge inside `<EdgeLabelRenderer>`:
  ```tsx
  <div
    className="nodrag nopan absolute flex flex-col items-center rounded-sm
               border border-border bg-card px-1.5 py-0.5 text-xs font-mono
               text-foreground"
    style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
             pointerEvents: "all" }}
  >
    <span>{PROTOCOL_LABEL[data.protocol]}</span>
    {data.apiRoute && (
      <span className="max-w-32 truncate text-text-subtle">{data.apiRoute}</span>
    )}
  </div>
  ```
  No `onClick` needed on the badge if `onEdgeClick` on `<ReactFlow>`
  already fires for label clicks; if label clicks don't propagate as
  edge clicks in testing, add an `onClick` that calls the same selection
  callback via a small context or prop — keep the edge presentational if
  possible (prefer the `onEdgeClick` route).

### 3. `components/canvas/edges/edge-types.ts` — React Flow `edgeTypes`

New file, module-level (same reasoning as `node-types.ts` — a stable
reference prevents React Flow's "edgeTypes changed" warning):

```ts
import { AnnotatedEdge } from "@/components/canvas/edges/annotated-edge"

export const edgeTypes = {
  annotated: AnnotatedEdge,
}
```

### 4. `components/canvas/property-panel.tsx` — shared panel shell

New client component. Presentational + callbacks only — it owns no
canvas state (that stays in `board-editor.tsx`, per `code-standards.md`:
don't mix state ownership into leaf UI).

- Props:
  ```ts
  interface PropertyPanelProps {
    selection:
      | { kind: "edge"; edge: BoardEdge }
      | { kind: "node"; node: BoardNode }
    onEdgeDataChange: (patch: Partial<AnnotatedEdgeData>) => void
    onNodeDataChange: (patch: Partial<SmartNodeData>) => void
    onClose: () => void
  }
  ```
  The parent only renders `<PropertyPanel>` when something is selected,
  so `selection` is non-null here.
- Shell: `absolute inset-y-0 right-0 z-40 w-80 border-l border-border
  bg-card` + the slide-in transition. Header (title + `X` button) then a
  `ScrollArea` body.
- **Edge body** (when `selection.kind === "edge"`), reading
  `annotatedEdgeDataSchema.safeParse(selection.edge.data)` with a
  default fallback:
  - **Protocol** — a 3-button segmented control built from shadcn
    `Button`s (no `select` primitive exists; don't add one). One button
    per `EDGE_PROTOCOLS` entry labeled via `PROTOCOL_LABEL`; the active
    protocol uses the default (accent) variant, the others
    `variant="outline"`. Click → `onEdgeDataChange({ protocol })`.
  - **Behavior** — a 2-button segmented control: "Sync" / "Async"
    toggling `onEdgeDataChange({ async: boolean })`. Active = accent.
  - **API route** — shadcn `Input`, `font-mono`, placeholder
    `GET /v1/...`; `onChange → onEdgeDataChange({ apiRoute: value })`
    (empty string → send `undefined` to clear).
  - **Load estimate** — shadcn `Input`, placeholder `e.g. 2k rps`;
    `onChange → onEdgeDataChange({ loadEstimate: value })` (empty →
    `undefined`).
- **Node body** (when `selection.kind === "node"`), reading
  `smartNodeDataSchema.safeParse(selection.node.data)`:
  - Header shows the category icon + `CATEGORY_LABEL[category]`.
  - **Label** — shadcn `Input`, `onChange → onNodeDataChange({ label })`.
    Guard against emptying it to `""` (the schema requires `min(1)`): if
    the field is blank, keep the stored label and show the empty input
    until the user types — do not write an invalid empty label.
  - **Sub-label** — shadcn `Input`, `font-mono`;
    `onChange → onNodeDataChange({ subLabel: value || undefined })`.
- Controlled inputs read from the live selected element (passed in as a
  prop), so edits reflect immediately as the parent updates state and
  re-renders.

### 5. `components/canvas/board-canvas.tsx` — register edges + click wiring

Existing file. Changes:

- Import `{ edgeTypes }` and `{ ANNOTATED_EDGE_TYPE }`; add to
  `<ReactFlow>`:
  - `edgeTypes={edgeTypes}`
  - `defaultEdgeOptions={{ type: ANNOTATED_EDGE_TYPE, data: DEFAULT_EDGE_DATA }}`
    so edges created by handle-drags render as annotated edges even
    before `onConnect` customizes them.
- Extend props with the three new handlers and forward them to
  `<ReactFlow>`:
  ```ts
  onEdgeClick: (event: React.MouseEvent, edge: BoardEdge) => void
  onNodeClick: (event: React.MouseEvent, node: BoardNode) => void
  onPaneClick: () => void
  ```
  Map to `onEdgeClick`, `onNodeClick`, and `onPaneClick` on
  `<ReactFlow>`. The component stays presentational — it just relays
  events upward.

### 6. `components/canvas/board-editor.tsx` — selection state + updaters

Existing file (already owns `nodes`/`edges` via `useNodesState` /
`useEdgesState`, `setNodes`/`setEdges`, and `markDirty`). Add:

- **Selection state:**
  ```ts
  const [selection, setSelection] =
    React.useState<{ kind: "edge" | "node"; id: string } | null>(null)
  ```
- **`onConnect`** — set id, type, and default data so every drawn edge
  is a fully-formed annotated edge:
  ```ts
  const onConnect: OnConnect = (connection) => {
    setEdges((current) =>
      addEdge(
        { ...connection, id: createEdgeId(),
          type: ANNOTATED_EDGE_TYPE, data: { ...DEFAULT_EDGE_DATA } },
        current,
      ),
    )
    markDirty()
  }
  ```
- **Click handlers:**
  ```ts
  const handleEdgeClick = (_: React.MouseEvent, edge: BoardEdge) =>
    setSelection({ kind: "edge", id: edge.id })
  const handleNodeClick = (_: React.MouseEvent, node: BoardNode) =>
    setSelection({ kind: "node", id: node.id })
  const handlePaneClick = () => setSelection(null)
  ```
- **Data updaters** (patch + mark dirty):
  ```ts
  const updateEdgeData = (patch: Partial<AnnotatedEdgeData>) => {
    if (selection?.kind !== "edge") return
    setEdges((current) =>
      current.map((e) =>
        e.id === selection.id
          ? { ...e, data: { ...(e.data as AnnotatedEdgeData), ...patch } }
          : e,
      ),
    )
    markDirty()
  }
  const updateNodeData = (patch: Partial<SmartNodeData>) => {
    if (selection?.kind !== "node") return
    setNodes((current) =>
      current.map((n) =>
        n.id === selection.id
          ? { ...n, data: { ...(n.data as SmartNodeData), ...patch } }
          : n,
      ),
    )
    markDirty()
  }
  ```
- **Resolve the selected element** for the panel and render it in the
  children slot (next to `BoardCanvas` and `AddNodeToolbar`):
  ```tsx
  {() => {
    const selectedEdge =
      selection?.kind === "edge"
        ? edges.find((e) => e.id === selection.id)
        : undefined
    const selectedNode =
      selection?.kind === "node"
        ? nodes.find((n) => n.id === selection.id)
        : undefined
    return (
      <div className="relative h-full w-full">
        <BoardCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onEdgeClick={handleEdgeClick}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
        />
        <AddNodeToolbar onAdd={handleAddNode} />
        {selectedEdge && (
          <PropertyPanel
            selection={{ kind: "edge", edge: selectedEdge }}
            onEdgeDataChange={updateEdgeData}
            onNodeDataChange={updateNodeData}
            onClose={() => setSelection(null)}
          />
        )}
        {selectedNode && (
          <PropertyPanel
            selection={{ kind: "node", node: selectedNode }}
            onEdgeDataChange={updateEdgeData}
            onNodeDataChange={updateNodeData}
            onClose={() => setSelection(null)}
          />
        )}
      </div>
    )
  }}
  ```
  Deriving `selectedEdge`/`selectedNode` from live `edges`/`nodes` (not
  from a snapshot captured at click time) keeps the panel's inputs in
  sync as `updateEdgeData`/`updateNodeData` mutate state. If the
  selected element is deleted, `find` returns `undefined` and the panel
  unmounts — selection self-heals.
- **Escape to close:** a small `React.useEffect` adding a `keydown`
  listener that clears `selection` on `Escape`, cleaned up on unmount.
- **Selected id ↔ React Flow highlight:** clicking an edge/node already
  flips React Flow's own `selected` flag (via `onNodesChange` /
  `onEdgesChange` `select` changes, which are correctly ignored by the
  existing dirty filter). The annotated edge and `SmartNode` already
  render their selected styling from that flag — no extra wiring needed.
  `onPaneClick` clears the panel; React Flow clears its own selection on
  the same pane click, so the two stay consistent.

### 7. No server / schema / migration changes

`saveCanvas` (`app/editor/[projectId]/actions.ts`) persists whatever
`{ nodes, edges }` the client sends through the loose
`canvasSnapshotSchema`. Edge `type` and `data` (protocol, async,
apiRoute, loadEstimate) and node `data.label`/`subLabel` are all unknown
keys preserved by `z.looseObject`. No Prisma change, no migration, no
Server Action change — identical to the Unit 08 conclusion.

### 8. Legacy / edge cases

- An edge persisted **without** `type` (theoretically possible from a
  hand-edited column) renders as a default React Flow edge with no
  annotated label. Clicking it still opens the panel; the first edit
  writes `data` but not `type`, so the label still won't render until
  `type` is `annotated`. This is an acceptable, non-crashing degraded
  state — new edges always get the type via `onConnect` /
  `defaultEdgeOptions`.
- A malformed edge `data` falls back to `DEFAULT_EDGE_DATA` at render
  (REST / sync) rather than crashing — mirrors `SmartNode` returning
  `null` on malformed node data.

## Dependencies

- **No new npm packages.** Everything is already installed:
  - `@xyflow/react` (Unit 07) — `BaseEdge`, `EdgeLabelRenderer`,
    `getSmoothStepPath`, `MarkerType`, `EdgeProps`, `onEdgeClick` /
    `onNodeClick` / `onPaneClick`, `defaultEdgeOptions`.
  - `zod` (Unit 06) — `annotatedEdgeDataSchema`.
  - `lucide-react` (Unit 01) — `X` (panel close) + the category icons
    reused from `node-style.ts`.
  - shadcn `Button`, `Input`, `ScrollArea` (Unit 01) — panel controls.
    No new shadcn primitive (`select` / `label` / `switch`) is added;
    protocol and sync/async use `Button` segmented controls.
  - `cn` (Unit 01) — class composition.

## Verify when done

- [ ] Dragging from a node's right (source) handle to another node's
      left (target) handle creates an edge that renders as a smooth-step
      connector with an arrowhead and a `REST` label badge at its
      midpoint.
- [ ] Clicking an edge (path or label) opens the right-anchored property
      panel; the edge shows its selected styling (accent stroke,
      thicker).
- [ ] Changing the protocol (REST / gRPC / WebSocket) updates the edge
      label badge immediately; the active protocol button is visibly
      selected (accent).
- [ ] Toggling Async makes the edge dashed; toggling back to Sync makes
      it solid.
- [ ] Typing an API route shows it as a second line under the protocol
      on the edge label (truncated when long); clearing it removes that
      line. Load estimate edits persist without affecting the label.
- [ ] Clicking a node opens the same panel in node mode (category icon +
      label); renaming updates the node title on the canvas live; the
      sub-label appears/updates on the node (mono) and clears when the
      field is emptied.
- [ ] Emptying the node label field does not write an invalid empty
      label (the node keeps its last valid label; schema `min(1)` is
      never violated).
- [ ] Clicking empty canvas (pane) closes the panel; pressing `Escape`
      closes it; the `X` button closes it.
- [ ] Any edge/node property edit flips save-status to `dirty`;
      **Save** persists it; a full page reload rehydrates every edge
      with its protocol/async/route/load and every node with its
      updated label/sub-label.
- [ ] Selecting a different element while the panel is open swaps the
      panel body to that element without a stale value flashing.
- [ ] Deleting the selected edge/node (via React Flow) closes the panel
      cleanly (no crash, no orphaned panel).
- [ ] The panel sits at `z-40`: it renders above the add-node toolbar
      (`z-30`) and canvas (`z-0`), and below dialogs (`z-50`); the
      project sidebar (`z-40`) still opens correctly.
- [ ] The panel and edge chrome use only chrome tokens — no `--node-*`
      palette color appears in the panel except the node-mode category
      icon (allowed inside `components/canvas/`).
- [ ] A manually corrupted edge `data` in Postgres renders the edge with
      default (REST / sync) annotation instead of crashing the canvas;
      other edges render normally.
- [ ] No React Flow "edgeTypes changed" warning (map is module-level).
- [ ] No TypeScript errors (`AnnotatedEdgeData` inferred from Zod; no
      `any`; `edgeTypes` / handlers typed via `@xyflow/react`).
- [ ] No console errors.
- [ ] Responsive at mobile and desktop: on a narrow viewport the
      `w-80` panel still fits (or the canvas remains usable beside it);
      the panel never overflows the viewport width.
- [ ] `npm run build` passes.
