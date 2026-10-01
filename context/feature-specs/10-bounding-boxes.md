# Unit 10: Bounding Boxes (Parent Grouping)

## Goal

Let a user select two or more existing nodes and wrap them in a
labeled, resizable bounding box (e.g. "Microservices Cluster") that
renders behind its members. Dragging the box moves every grouped node
with it; the box can be renamed, recolored, resized, and ungrouped. The
box is a plain React Flow node (`type: "group"`), so it round-trips
through the existing loose `canvasSnapshotSchema` with no server, Prisma,
or migration change.

## Design

### Why a background box, not React Flow `parentId`

This unit deliberately does **not** use React Flow's native
`parentId` / sub-flow mechanism. The box is its own node drawn *behind*
its members, and membership is tracked in the box's `data.childIds`.
Dragging the box propagates the drag delta to the member nodes
explicitly. The reason is an existing invariant: `nextLanePosition` in
[lib/canvas.ts](../../lib/canvas.ts) reads **absolute** `node.position.y`
to stack nodes in a swimlane, the loose node schema persists raw node
objects, and Unit 13 will sync the node array through Liveblocks. Native
`parentId` would convert child positions to **relative** coordinates and
force parents to precede children in the array — both would break
swimlane stacking and complicate persistence/sync. Keeping every node at
absolute coordinates preserves all three. (Per `code-standards.md` — "fix
root causes, do not layer workarounds": the explicit drag-propagation
handler is a small, contained concern, not a CSS/offset hack.)

### Visual identity

The box is a canvas-only element (never chrome), so it may carry color,
but it must read as a *container*, distinct from a smart node:

- **Shape:** `rounded-md border-2 border-dashed` with a low-opacity
  tint fill (~8%). Dashed border + larger radius padding distinguishes
  it from the solid-bordered smart nodes (`ui-context.md` → *Border
  Radius*: panels/nodes use `rounded-md`).
- **Label chip:** top-left, inside the box, a small chip
  (`rounded-sm border bg-card px-2 py-0.5 text-xs font-medium`,
  `ui-context.md` small-UI radius) showing a `Boxes` Lucide icon
  (`h-4 w-4`, `strokeWidth={1.5}`) tinted the box color plus the box
  label text in neutral `text-foreground`. The chip color signal comes
  from the icon only, mirroring the add-node toolbar convention from
  Unit 08.
- **Selection:** when selected, border color shifts to
  `--accent-primary` (reusing the Unit 07/08 selection convention) and
  the `NodeResizer` handles appear.
- **Z-order:** the box renders *behind* all smart nodes and edges within
  the React Flow viewport (see *Z-order* below). It never occludes its
  members; only its empty margin is directly clickable.

### Box color palette (canvas-only)

Recolor needs a small, fixed set of tints. These are **new, dedicated
`--group-*` tokens** — the `--node-*` palette stays reserved for smart
nodes per `ui-context.md`, so boxes do not borrow it even where a hue
coincides. Five options keep clusters visually separable without
palette sprawl:

| Key    | Token            | Hex       | Role                 |
| ------ | ---------------- | --------- | -------------------- |
| slate  | `--group-slate`  | `#94a3b8` | Neutral default      |
| cyan   | `--group-cyan`   | `#22d3ee` | Accent-aligned       |
| amber  | `--group-amber`  | `#f59e0b` | Warm cluster         |
| green  | `--group-green`  | `#10b981` | Service cluster      |
| purple | `--group-purple` | `#a855f7` | Async/data cluster   |

Each gets a `-bg` variant at ~8% alpha (`#rrggbb14`) for the fill. All
ten are added under both `:root` and `.dark` and mapped into
`@theme inline` as `--color-group-*` / `--color-group-*-bg`, exactly as
the `--node-*` tokens were exposed in Unit 08, so `border-group-amber`,
`bg-group-amber-bg`, `text-group-amber` resolve as utilities. Default on
creation is `slate`.

### Z-order (inside the React Flow viewport)

This is the viewport's internal node layering, separate from the chrome
`z-index` hierarchy in `ui-context.md` (the whole canvas sits at the
chrome canvas layer; the add-node toolbar `z-30`, property panel `z-40`
are unchanged by this unit). Within the flow:

- Group nodes are created with React Flow `zIndex: 0` **and prepended**
  to the nodes array, so with equal `zIndex` they draw before (behind)
  the smart nodes that follow them. Smart nodes keep their default
  layering and sit above the box.
- A box being *dragged or selected* may be elevated briefly by React
  Flow; that is acceptable (the selection outline should be visible) and
  does not change persisted order.
- Note for Unit 13: Liveblocks must preserve group-before-child array
  order (or set an explicit lower `zIndex` on groups) to keep boxes
  behind their members.

## Implementation

### 1. `lib/canvas.ts` — group type, schema, constants, pure helpers

Add alongside the existing node/edge contracts (keep `nodeSchema`
permissive so group nodes round-trip — do **not** require the group
schema board-wide; validate at the render/panel boundary like
`smartNodeDataSchema`):

- Constant and ids:
  ```ts
  export const GROUP_NODE_TYPE = "group"

  export function createGroupId(): string {
    return `g_${crypto.randomUUID()}`
  }
  ```
  The `g_` prefix mirrors `n_` (nodes) / `e_` (edges) for readable JSON
  dumps.

- Color palette:
  ```ts
  export const GROUP_COLORS = [
    "slate", "cyan", "amber", "green", "purple",
  ] as const
  export type GroupColor = (typeof GROUP_COLORS)[number]
  export const DEFAULT_GROUP_COLOR: GroupColor = "slate"
  ```

- Layout constants (padding around members, header room for the chip,
  minimum size the resizer may shrink to):
  ```ts
  export const GROUP_PADDING = 24  // gap between members and box edge
  export const GROUP_HEADER = 28   // extra top room for the label chip
  export const GROUP_MIN_WIDTH = 160
  export const GROUP_MIN_HEIGHT = 120
  ```

- Persisted `data` schema (validated where rendered/edited, not board-
  wide):
  ```ts
  export const groupNodeDataSchema = z.object({
    label: z.string().min(1).max(80),
    color: z.enum(GROUP_COLORS).default(DEFAULT_GROUP_COLOR),
    childIds: z.array(z.string()).default([]),
  })
  export type GroupNodeData = z.infer<typeof groupNodeDataSchema>

  export const DEFAULT_GROUP_LABEL = "Group"
  ```
  `childIds` lives only on the box — children are never mutated to point
  back, so grouping/ungrouping touches one node.

- **Pure bounds helper** (no React Flow imports; unit-testable, reused by
  create and any future auto-fit):
  ```ts
  export interface GroupBounds { x: number; y: number; width: number; height: number }

  interface MeasuredNode {
    position: { x: number; y: number }
    measured?: { width?: number; height?: number }
  }

  /** Smallest box (with padding + header room) enclosing the members. */
  export function computeGroupBounds(
    members: readonly MeasuredNode[],
  ): GroupBounds {
    const rects = members.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      w: n.measured?.width ?? NODE_WIDTH,
      h: n.measured?.height ?? NODE_HEIGHT,
    }))
    const minX = Math.min(...rects.map((r) => r.x))
    const minY = Math.min(...rects.map((r) => r.y))
    const maxX = Math.max(...rects.map((r) => r.x + r.w))
    const maxY = Math.max(...rects.map((r) => r.y + r.h))
    return {
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_HEADER,
      width: maxX - minX + GROUP_PADDING * 2,
      height: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER,
    }
  }
  ```
  Falls back to `NODE_WIDTH`/`NODE_HEIGHT` for not-yet-measured nodes so
  grouping works even immediately after a programmatic add.

### 2. `app/globals.css` — group tokens

Add the five `--group-*` colors and their `-bg` (~8% alpha, `#rrggbb14`)
variants under both `:root` and `.dark`, then map all ten into
`@theme inline` as `--color-group-*` / `--color-group-*-bg`. Same
mechanical pattern as the Unit 08 `--node-*` block — spelled out so the
Tailwind scanner emits `border-group-*`, `bg-group-*-bg`,
`text-group-*`. The `--group-*` palette is used **only** inside
`components/canvas/` (the box node and the property panel's color
picker), never in chrome.

### 3. `components/canvas/groups/group-style.ts` — color → class map

New plain-TS file (mirrors `nodes/node-style.ts`). One source of truth
for the box color classes, consumed by both the group node and the
panel's color picker so the two never fork:

```ts
export const GROUP_STYLE: Record<
  GroupColor,
  { border: string; bg: string; icon: string; swatch: string }
> = {
  slate:  { border: "border-group-slate",  bg: "bg-group-slate-bg",  icon: "text-group-slate",  swatch: "bg-group-slate" },
  cyan:   { border: "border-group-cyan",   bg: "bg-group-cyan-bg",   icon: "text-group-cyan",   swatch: "bg-group-cyan" },
  amber:  { border: "border-group-amber",  bg: "bg-group-amber-bg",  icon: "text-group-amber",  swatch: "bg-group-amber" },
  green:  { border: "border-group-green",  bg: "bg-group-green-bg",  icon: "text-group-green",  swatch: "bg-group-green" },
  purple: { border: "border-group-purple", bg: "bg-group-purple-bg", icon: "text-group-purple", swatch: "bg-group-purple" },
}
```

Classes are enumerated (not interpolated) so none are purged.

### 4. `components/canvas/groups/group-node.tsx` — the box node

New file, `"use client"`, memoized (like `SmartNode`). All boxes render
through this one component.

- Signature `({ data, selected }: NodeProps)`. Validate with
  `groupNodeDataSchema.safeParse(data)`; on failure return `null` (a
  corrupted box disappears but never crashes the canvas — same boundary
  rule as `SmartNode`).
- Root fills the node's own box (React Flow sizes the wrapper from the
  node's `width`/`height`; the inner div is `h-full w-full`):
  ```tsx
  <>
    <NodeResizer
      isVisible={selected}
      minWidth={GROUP_MIN_WIDTH}
      minHeight={GROUP_MIN_HEIGHT}
      lineClassName="!border-primary"
      handleClassName="!bg-primary !border-0"
    />
    <div
      className={cn(
        "h-full w-full rounded-md border-2 border-dashed",
        style.border, style.bg,
        selected && "!border-primary",
      )}
    >
      <span className="absolute left-2 top-2 inline-flex items-center gap-1
                       rounded-sm border border-border bg-card px-2 py-0.5">
        <Boxes className={cn("h-4 w-4 shrink-0", style.icon)} strokeWidth={1.5} />
        <span className="max-w-40 truncate text-xs font-medium text-foreground">
          {label}
        </span>
      </span>
    </div>
  </>
  ```
  - `NodeResizer` and its handle styling come from
    `@xyflow/react/dist/style.css`, already imported in
    `board-canvas.tsx` — no new import of CSS.
  - **Handles (revised after review):** a left target and a right source
    `Handle`, styled like `SmartNode`'s, so a box that stands for a
    service can be connected with the same annotated edges as any node
    ("Client → Order Service"). Ungrouping removes edges attached to the
    box (React Flow's Delete key already does).
- The box must not block interaction with members that sit above it; it
  does so naturally because members render on top (see *Z-order*). The
  label chip and the box margin remain the click targets for selecting
  the box.

### 5. `components/canvas/nodes/node-types.ts` — register `group`

Add the group type to the existing module-level map (keep it module-
level so React Flow doesn't warn):

```ts
import { GroupNode } from "@/components/canvas/groups/group-node"
export const nodeTypes = {
  client: SmartNode, lb: SmartNode, compute: SmartNode,
  cache: SmartNode, queue: SmartNode, database: SmartNode,
  group: GroupNode,
}
```

### 6. `components/canvas/board-canvas.tsx` — forward drag + resize

The box's move-together and resize-dirty logic lives in `BoardEditor`
(it owns `setNodes`), so `BoardCanvas` only needs to forward three more
React Flow callbacks onto `<ReactFlow>`:

- Add to `BoardCanvasProps` and pass through:
  `onNodeDrag`, `onNodeDragStop` (both `OnNodeDrag<BoardNode>`), and keep
  the existing `onNodesChange` (resize changes already flow through it).
- `NodeResizer` emits its size/position updates as node changes through
  the existing `onNodesChange` pipeline, so nothing else is needed for
  resize other than the dirty-tracking tweak in §7.

### 7. `components/canvas/board-editor.tsx` — create, drag, resize, edit

Existing file. Additions:

- **Track multi-selection** (grouping needs the full selected set, not
  just the single-element `selection`). In `handleSelectionChange`, also
  record the selected *non-group* node ids:
  ```ts
  const [groupableIds, setGroupableIds] = React.useState<string[]>([])
  // inside handleSelectionChange:
  setGroupableIds(
    selectedNodes
      .filter((n) => n.type !== GROUP_NODE_TYPE)
      .map((n) => n.id),
  )
  ```
  `canGroup = groupableIds.length >= 2`.

- **Create** a box from the current selection:
  ```ts
  const handleGroup = () => {
    const members = nodes.filter((n) => groupableIds.includes(n.id))
    if (members.length < 2) return
    const bounds = computeGroupBounds(members)
    const id = createGroupId()
    const groupNode: BoardNode = {
      id,
      type: GROUP_NODE_TYPE,
      position: { x: bounds.x, y: bounds.y },
      width: bounds.width,
      height: bounds.height,
      zIndex: 0,
      data: {
        label: DEFAULT_GROUP_LABEL,
        color: DEFAULT_GROUP_COLOR,
        childIds: members.map((m) => m.id),
      } satisfies GroupNodeData,
    }
    // Prepend so the box draws behind its members.
    setNodes((current) => [groupNode, ...current])
    markDirty()
    setSelection({ kind: "group", id }) // open the panel on the new box
  }
  ```

- **Move-together** via drag propagation (nested in a ref so each tick
  applies only the incremental delta):
  ```ts
  const groupDrag = React.useRef<{ id: string; x: number; y: number } | null>(null)

  const handleNodeDrag: OnNodeDrag<BoardNode> = (_e, node) => {
    if (node.type !== GROUP_NODE_TYPE) return
    const prev = groupDrag.current
    const last = prev && prev.id === node.id ? prev : { id: node.id, x: node.position.x, y: node.position.y }
    const dx = node.position.x - last.x
    const dy = node.position.y - last.y
    groupDrag.current = { id: node.id, x: node.position.x, y: node.position.y }
    if (dx === 0 && dy === 0) return
    const childIds = new Set(
      (node.data as GroupNodeData).childIds ?? [],
    )
    setNodes((current) =>
      current.map((n) =>
        // Move members that aren't themselves part of the active multi-
        // selection drag (React Flow already moves selected ones).
        childIds.has(n.id) && !n.selected
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n,
      ),
    )
  }

  const handleNodeDragStop: OnNodeDrag<BoardNode> = (_e, node) => {
    if (groupDrag.current?.id === node.id) {
      groupDrag.current = null
      markDirty() // member moves above don't pass through handleNodesChange
    }
  }
  ```
  The `!n.selected` guard prevents double-moving a member that the user
  explicitly multi-selected together with the box.

- **Resize dirtying.** `handleNodesChange` currently treats `dimensions`
  changes as non-edits (so measurement never dirties the board). A
  user-driven resize also arrives as a `dimensions` change but carries
  `resizing: true`. Narrow the filter so a resize on a group *does*
  dirty:
  ```ts
  if (changes.some((c) =>
      (c.type !== "select" && c.type !== "dimensions") ||
      (c.type === "dimensions" && c.resizing),
  )) {
    markDirty()
  }
  ```
  (Measurement `dimensions` changes have no `resizing` flag, so the Unit
  08 reveal-on-measure path is unaffected.)

- **Resolve the panel selection** for a group. Extend the existing
  `panelSelection` resolution: if the selected node's `type` is
  `GROUP_NODE_TYPE`, build a `{ kind: "group", node }` selection instead
  of the smart-node branch. Add a `handleSelectionChange` mapping so a
  single selected group opens the panel as a group.

- **Edit handlers** passed to the panel:
  ```ts
  const updateGroupData = (patch: Partial<GroupNodeData>) => {
    if (selection?.kind !== "group") return
    setNodes((current) =>
      current.map((n) =>
        n.id === selection.id ? { ...n, data: { ...n.data, ...patch } } : n),
    )
    markDirty()
  }

  const ungroup = () => {
    if (selection?.kind !== "group") return
    setNodes((current) => current.filter((n) => n.id !== selection.id))
    markDirty()
    clearSelection()
  }
  ```
  **Delete-box-only is automatic:** children are independent nodes, so
  removing the group node (via `ungroup`, or React Flow's Delete key on a
  selected box) never touches members. No cascade handling needed.

- **Wire it up:** forward `onNodeDrag={handleNodeDrag}` and
  `onNodeDragStop={handleNodeDragStop}` to `BoardCanvas`; render the
  group branch of `PropertyPanel`; pass `onGroup`/`canGroup` to the
  toolbar (§8).

### 8. `components/canvas/add-node-toolbar.tsx` — group action

Add a trailing group action to the existing bottom-center toolbar,
separated from the category buttons by a thin divider so it reads as a
different kind of action:

- Props add `{ onGroup: () => void; canGroup: boolean }`.
- After the six category buttons, render a divider
  (`<div className="mx-1 h-5 w-px bg-border" />`) then:
  ```tsx
  <Button
    variant="ghost"
    size="sm"
    onClick={onGroup}
    disabled={!canGroup}
    aria-label="Group selected nodes"
    title={canGroup ? "Group selected nodes" : "Select 2+ nodes to group"}
  >
    <Boxes className="h-4 w-4" strokeWidth={1.5} />
    <span className="text-xs font-medium">Group</span>
  </Button>
  ```
  Disabled (greyed) until two or more smart nodes are selected. The
  button keeps neutral chrome styling; it is not tied to a color.

### 9. `components/canvas/property-panel.tsx` — group branch

Extend the shared panel (do not add a second panel component):

- Widen `PropertyPanelSelection`:
  ```ts
  export type PropertyPanelSelection =
    | { kind: "edge"; edge: BoardEdge }
    | { kind: "node"; node: BoardNode }
    | { kind: "group"; node: BoardNode }
  ```
- `PropertyPanelProps` gains `onGroupDataChange: (patch: Partial<GroupNodeData>) => void`
  and `onUngroup: () => void`.
- `PanelTitle`: for `kind: "group"`, show a `Boxes` icon tinted with the
  box color plus the word "Group".
- New `GroupFields` (keyed by node id, like `NodeFields`):
  - **Label** `Input`, `maxLength={80}`, with the same non-empty guard
    `NodeFields` uses (blank draft never written; blur restores the
    stored label — the `min(1)` schema is never violated).
  - **Color** picker: a row of five swatch buttons from `GROUP_STYLE`
    (`swatch` class), the active one ringed with `--accent-primary`
    (`aria-pressed`); clicking calls `onChange({ color })`.
  - **Ungroup** button (`variant="outline"`, full width, `Unglue`/
    `Ungroup` not needed — use a `Boxes`-off style label "Ungroup") that
    calls `onUngroup`. Copy clarifies it keeps the nodes:
    "Dissolve the box (keeps the nodes)".
- Validate `node.data` with `groupNodeDataSchema.safeParse`; on failure
  show the same "data is invalid, can't be edited" message pattern as
  the node branch.

### 10. No Save / schema / migration change

`saveCanvas` and `canvasSnapshotSchema` already accept any node via the
loose `nodeSchema` (unknown keys — `width`, `height`, `zIndex`,
`data.childIds`, `data.color` — are preserved). A group is just a node
with `type: "group"`. Reload rehydrates boxes with their size, color,
label, and membership. No `app/editor/[projectId]/actions.ts`, Prisma,
or migration change.

## Dependencies

- No new npm packages. Everything is already installed:
  - `@xyflow/react` (Unit 07) — `NodeResizer`, `NodeProps`,
    `OnNodeDrag`, and the resizer CSS (already imported via
    `@xyflow/react/dist/style.css`).
  - `lucide-react` (Unit 01) — the `Boxes` icon.
  - `zod` (Unit 06) — `groupNodeDataSchema` boundary validation.
  - `cn` (Unit 01) and shadcn `Button` / `Input` / `ScrollArea`
    (Unit 01) — panel and toolbar.

## Verify when done

- [ ] The five `--group-*` and `--group-*-bg` CSS variables exist under
      both `:root` and `.dark` and are mapped in `@theme inline` so
      `border-group-amber`, `bg-group-amber-bg`, `text-group-amber`
      resolve in the built CSS.
- [ ] With two or more smart nodes selected, the toolbar's **Group**
      button enables; with fewer selected it is disabled.
- [ ] Clicking **Group** wraps the selected nodes in a dashed, tinted
      box that encloses them with padding and renders **behind** them;
      the box carries a top-left label chip ("Group") and the box
      becomes selected (panel opens on it).
- [ ] Dragging the box moves every member node with it by the same
      delta; non-member nodes do not move; members keep their relative
      arrangement.
- [ ] Selecting the box shows resize handles; resizing changes the box
      size (down to the minimum) without moving or resizing members, and
      marks the board dirty.
- [ ] The property panel's group branch renames the box (blank input
      never persists; blur restores the last valid label), recolors it
      from the five swatches (box border/fill/chip-icon update live),
      and **Ungroup** removes the box while leaving every member node in
      place.
- [ ] Pressing Delete/Backspace on a selected box removes only the box,
      never its members.
- [ ] Adding a box, moving it, resizing it, renaming, recoloring, and
      ungrouping each flip the status to **Unsaved**; **Save** then a
      full page reload rehydrates the box with its position, size, color,
      label, and membership, still behind its members.
- [ ] Grouping does not disturb swimlane spawning: after grouping some
      nodes, adding a new node of the same category from the toolbar
      still stacks it below the lane's existing nodes with no overlap
      (members kept absolute coordinates).
- [ ] A box whose `data` is manually corrupted in Postgres (e.g. missing
      `label`) renders as nothing and is non-editable in the panel —
      the rest of the canvas still loads (no crash).
- [ ] The `--group-*` palette is used only inside `components/canvas/`;
      the `--node-*` palette is not reused for boxes.
- [ ] No TypeScript errors (`GroupNodeData` inferred from Zod; no `any`;
      `nodeTypes` and the drag callbacks typed via `@xyflow/react`).
- [ ] No console errors and no React Flow "nodeTypes changed" warning
      (the map stays module-level).
- [ ] Responsive at mobile and desktop: the toolbar (now with the Group
      action) stays centered and wraps on narrow viewports; the property
      panel group branch fits the 320px panel without horizontal scroll.
- [ ] `npm run build` passes.
