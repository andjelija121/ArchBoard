# Unit 08: Smart Infrastructure Nodes + Swimlane Layout + Add-Node Toolbar

## Goal

Register the six custom React Flow node types (Client, Load Balancer,
Compute, Cache, Queue/Broker, Database) with category colors and icons
per `ui-context.md`, add a pure swimlane coordinate helper that maps a
category to its X column and a non-overlapping Y, and mount a small
floating canvas toolbar that spawns a styled draggable node in the
correct lane. Establishes the persisted node-`data` schema that the AI
backend (Unit 12) must produce.

## Design

### Design tokens (add to `app/globals.css`)

Close the two open items in `progress-tracker.md`:

- Under `:root`, add the six `--node-*` full-opacity colors from
  `ui-context.md` → *Node Category Palette*:
  ```css
  --node-client:   #94a3b8;
  --node-lb:       #f59e0b;
  --node-compute:  #10b981;
  --node-cache:    #ef4444;
  --node-queue:    #a855f7;
  --node-database: #3b82f6;
  ```
  Also add a `-bg` variant per category at ~15% opacity for node fills
  (hex `#rrggbb26` is a mechanical 15% alpha):
  ```css
  --node-client-bg:   #94a3b826;
  --node-lb-bg:       #f59e0b26;
  --node-compute-bg:  #10b98126;
  --node-cache-bg:    #ef444426;
  --node-queue-bg:    #a855f726;
  --node-database-bg: #3b82f626;
  ```
  Duplicate the same block under `.dark` so both selectors keep parity
  with every other token in the file (dark-only theme still writes to
  both, per the existing pattern).
- Map every new token into the `@theme inline` block as
  `--color-node-*` / `--color-node-*-bg` so they resolve as Tailwind
  utilities (`bg-node-database-bg`, `text-node-database`,
  `border-node-database`). Mirrors how the state tokens were exposed in
  Unit 07's follow-up.
- `--radius` is already defined (`0.625rem`) — no new value needed.
  Smart nodes use `rounded-md` (per `ui-context.md` → *Border Radius*),
  which resolves through `--radius-md`. No hardcoded pixels anywhere.

Never use the `--node-*` palette in chrome UI (`ui-context.md`
invariant); it stays inside `components/canvas/` and the sidebar
category badge in Unit 11's future scope only.

### Category → visual identity

Fixed map, single source of truth in `lib/canvas.ts` (see §1). Icons
per `ui-context.md` → *Icons*, stroke 1.5, size `h-5 w-5` inside a node.

| Category | Enum value | Lucide icon | Token base   |
| -------- | ---------- | ----------- | ------------ |
| Client         | `client`   | `Monitor`      | `--node-client`   |
| Load Balancer  | `lb`       | `Split`        | `--node-lb`       |
| Compute        | `compute`  | `Server`       | `--node-compute`  |
| Cache          | `cache`    | `Zap`          | `--node-cache`    |
| Queue / Broker | `queue`    | `ListOrdered`  | `--node-queue`    |
| Database       | `database` | `Database`     | `--node-database` |

### Node shape

Each smart node renders a `rounded-md` card, `w-44` (176px) fixed width,
`min-h-14` (56px) — enough for a 20px icon column plus a label row plus
optional sub-label. Structure:

- **Root:** `rounded-md border border-[color] bg-[color-bg] p-3
  flex items-center gap-2` where `[color]` is the category token and
  `[color-bg]` its `-bg` variant. Border thickens to `border-2` and
  color shifts to `--accent-primary` when React Flow's `selected` prop
  is true (matches Unit 07's selection convention).
- **Icon column:** the Lucide icon at `h-5 w-5`, `strokeWidth={1.5}`,
  color = the full-opacity category token.
- **Label column** (flex-1, min-w-0):
  - Title: `text-sm font-medium text-foreground truncate` — the
    `label` field on `data`.
  - Sub-label: `text-xs font-mono text-muted-foreground truncate` — the
    optional `subLabel` field (e.g., `postgres`, `nginx`); rendered only
    when present, since Unit 08 doesn't collect it in the toolbar.
- **Handles:** one `Handle` of `type="source"` on `Position.Right` and
  one `type="target"` on `Position.Left`, each `!bg-border`
  `!w-2 !h-2 !border-0` (subtle dots — they exist mainly for the
  edge-drag interaction and Unit 09 to attach to). Bang prefix required
  because React Flow ships its own `.react-flow__handle` styles that
  win by specificity without it.

All six types are visually identical up to the icon and color tokens —
they share one presentational base (§2), diverge only in the map at §1.

### Swimlanes (canvas coordinate model)

Six vertical columns, left→right, one per category. Order matches the
data-flow rank in `project-overview.md` → *Swimlane-based Spawning*
(clients on the left, data layer on the right):

```
Column index → category:
  0 → client
  1 → lb
  2 → compute
  3 → cache
  4 → queue
  5 → database
```

Constants (in `lib/canvas.ts`, so both the toolbar and Unit 12's AI
spawner import from one place):

- `NODE_WIDTH = 176` (matches Tailwind's `w-44`; the visible node width)
- `NODE_HEIGHT = 56` (matches `min-h-14`; used only for overlap math —
  actual rendered height may grow with `subLabel` but 56 is the layout
  reservation)
- `COLUMN_GAP = 80` (whitespace between columns)
- `COLUMN_STEP = NODE_WIDTH + COLUMN_GAP` (= 256, one column pitch)
- `ROW_HEIGHT = NODE_HEIGHT + 24` (= 80, one row pitch inside a column)
- `LANE_TOP = 40` (initial Y offset from board origin)

Column X for a category = `SWIMLANE_ORDER.indexOf(category) * COLUMN_STEP`.
No horizontal centering math — React Flow's `fitView` handles framing.

### Add-node toolbar

Floating bottom-center on the canvas, above the React Flow `Controls`.
Six icon buttons, one per category, in the same left→right swimlane
order — visually reinforces which lane each type spawns into.

- Container: `absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex
  items-center gap-1 rounded-md border border-border bg-card p-1
  shadow-sm` — inside the React Flow viewport, `z-30` (node-selection
  layer per `ui-context.md`); safely below the AI sidebar (`z-40`) and
  modals (`z-50`).
- Each button: shadcn `Button` `variant="ghost" size="sm"` with the
  category's Lucide icon at `h-4 w-4` (colored with `text-node-*`)
  **followed by the category label** as visible text (`text-xs
  font-medium text-foreground`, no truncation — the labels are short
  enough that all six fit). `aria-label="Add {category label}"`.
  The palette color appears only on the icon; the label stays neutral
  chrome text so the identity signal comes from the icon alone.
- Hover: default ghost-button `bg-accent`; the icon color does not
  change (identity signal).
- Full toolbar width fits well under a desktop viewport (six ~90–110px
  buttons + gaps ≈ 700px). At narrow widths it wraps naturally: use
  `flex-wrap` on the container and let the buttons re-flow into two
  rows rather than clipping — the toolbar's `bottom-4 left-1/2
  -translate-x-1/2` anchoring keeps it centered as it grows taller.

## Implementation

### 1. `lib/canvas.ts` — extend with category schema, layout constants, and helpers

The file already owns the persisted-canvas type/schema (Unit 07). Add
node-type identity and layout math here so both the toolbar and the
AI-spawner in Unit 12 import from one module — this file is the
contract Unit 12 must honor (build plan: "establishes the node schema
the AI backend must match").

- `export const NODE_CATEGORIES = ["client", "lb", "compute", "cache",
  "queue", "database"] as const` and
  `export type NodeCategory = (typeof NODE_CATEGORIES)[number]`.
- `export const SWIMLANE_ORDER: readonly NodeCategory[] = NODE_CATEGORIES`
  (same array reused so column order is impossible to desync from the
  enum).
- Layout constants exported at module scope:
  ```ts
  export const NODE_WIDTH = 176
  export const NODE_HEIGHT = 56
  export const COLUMN_GAP = 80
  export const COLUMN_STEP = NODE_WIDTH + COLUMN_GAP // 256
  export const ROW_HEIGHT = NODE_HEIGHT + 24         // 80
  export const LANE_TOP = 40
  ```
- Category display map (label + Lucide component name as a string; the
  actual icon import happens in the presentational component so this
  file stays free of React imports):
  ```ts
  export const CATEGORY_LABEL: Record<NodeCategory, string> = {
    client: "Client",
    lb: "Load Balancer",
    compute: "Compute",
    cache: "Cache",
    queue: "Queue / Broker",
    database: "Database",
  }
  ```
- **Persisted `data` schema.** Extend the existing `nodeSchema` (still
  `z.looseObject` so unknown keys survive round-trips) so custom nodes
  have a typed core:
  ```ts
  export const smartNodeDataSchema = z.object({
    category: z.enum(NODE_CATEGORIES),
    label: z.string().min(1).max(80),
    subLabel: z.string().max(80).optional(),
  })
  export type SmartNodeData = z.infer<typeof smartNodeDataSchema>
  ```
  The board-wide `nodeSchema` keeps its permissive `data` (default
  nodes and future AI nodes must still parse), but `SmartNode` renderers
  validate at the boundary with `smartNodeDataSchema.parse` — see §2.
- **Swimlane helper — pure function, no React Flow types:**
  ```ts
  export interface SpawnPlacement { x: number; y: number }

  export function nextLanePosition(
    category: NodeCategory,
    existingNodes: readonly { position: { x: number; y: number }; data?: unknown }[],
  ): SpawnPlacement {
    const columnIndex = SWIMLANE_ORDER.indexOf(category)
    const x = columnIndex * COLUMN_STEP
    // Take the highest occupied row *in this lane only*, then step below.
    const inLaneY = existingNodes
      .filter((n) => {
        const cat = (n.data as { category?: unknown } | undefined)?.category
        return cat === category
      })
      .map((n) => n.position.y)
    const nextY = inLaneY.length === 0
      ? LANE_TOP
      : Math.max(...inLaneY) + ROW_HEIGHT
    return { x, y: nextY }
  }
  ```
  Pure, deterministic, and takes a plain array so it's trivially unit-
  testable and reusable by the Unit 12 spawner. It considers only the
  target lane's nodes for non-overlap — cross-lane collision is
  impossible because columns are `COLUMN_STEP` (256px) apart and
  `NODE_WIDTH` is 176px, so lanes never touch horizontally.
- **ID helper** (avoid `crypto.randomUUID()` collision with server
  values; the same helper is safe to use client- or server-side):
  ```ts
  export function createNodeId(): string {
    return `n_${crypto.randomUUID()}`
  }
  ```
  React Flow only requires string uniqueness; the `n_` prefix
  distinguishes hand-added from AI-added nodes at a glance in JSON
  dumps.

### 2. `components/canvas/nodes/smart-node.tsx` — one presentational base

New file, `"use client"`. Single component that all six categories
render through — no per-category subclasses.

- Import `{ Handle, Position, type NodeProps }` from `@xyflow/react`.
- Icon map (this is the one place the React icon imports live):
  ```ts
  import { Database, ListOrdered, Monitor, Server, Split, Zap } from "lucide-react"
  const ICONS: Record<NodeCategory, LucideIcon> = {
    client: Monitor, lb: Split, compute: Server,
    cache: Zap, queue: ListOrdered, database: Database,
  }
  ```
- Component signature:
  ```ts
  export function SmartNode({ data, selected }: NodeProps) {
    const parsed = smartNodeDataSchema.safeParse(data)
    if (!parsed.success) return null // malformed persisted data → skip render
    const { category, label, subLabel } = parsed.data
    const Icon = ICONS[category]
    // Class map keyed on category so Tailwind's static analysis keeps
    // every color in the built CSS (dynamic `text-node-${cat}` strings
    // get purged, so enumerate them here).
    // ...
  }
  ```
- **Tailwind class map** (spelled out per category so JIT emits them —
  do not build class strings from interpolation):
  ```ts
  const STYLES: Record<NodeCategory, { border: string; bg: string; icon: string }> = {
    client:   { border: "border-node-client",   bg: "bg-node-client-bg",   icon: "text-node-client" },
    lb:       { border: "border-node-lb",       bg: "bg-node-lb-bg",       icon: "text-node-lb" },
    compute:  { border: "border-node-compute",  bg: "bg-node-compute-bg",  icon: "text-node-compute" },
    cache:    { border: "border-node-cache",    bg: "bg-node-cache-bg",    icon: "text-node-cache" },
    queue:    { border: "border-node-queue",    bg: "bg-node-queue-bg",    icon: "text-node-queue" },
    database: { border: "border-node-database", bg: "bg-node-database-bg", icon: "text-node-database" },
  }
  ```
- Render:
  ```tsx
  <div
    className={cn(
      "flex w-44 min-h-14 items-center gap-2 rounded-md border p-3",
      s.border, s.bg,
      selected && "border-2 border-primary",
    )}
  >
    <Icon className={cn("h-5 w-5 shrink-0", s.icon)} strokeWidth={1.5} />
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium text-foreground">{label}</span>
      {subLabel && (
        <span className="truncate font-mono text-xs text-muted-foreground">{subLabel}</span>
      )}
    </div>
    <Handle type="target" position={Position.Left}  className="!h-2 !w-2 !border-0 !bg-border" />
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-border" />
  </div>
  ```
- Wrap in `React.memo` — React Flow re-renders visible nodes on any
  viewport move; memoizing on `data`/`selected` is standard practice.

### 3. `components/canvas/nodes/node-types.ts` — React Flow `nodeTypes` map

New file, plain TS (no `"use client"` needed by itself but consumed
only from client components). Exports one static object that
`board-canvas.tsx` passes to `<ReactFlow nodeTypes={...} />`. All six
categories share `SmartNode`:

```ts
import { SmartNode } from "./smart-node"
export const nodeTypes = {
  client: SmartNode,
  lb: SmartNode,
  compute: SmartNode,
  cache: SmartNode,
  queue: SmartNode,
  database: SmartNode,
} as const
```

Keep the object **module-level** (not built inside a component); React
Flow warns on every render if `nodeTypes` is a new reference.

### 4. `components/canvas/board-canvas.tsx` — register `nodeTypes`

Existing file. One change only:

- Import `{ nodeTypes }` and pass it to `<ReactFlow nodeTypes={nodeTypes} …>`.
- No prop changes; no toolbar mounting here (the toolbar sits at the
  editor level so it can call state setters — see §5).

### 5. `components/canvas/add-node-toolbar.tsx` — the floating palette

New client component. Presentational + one callback; no React Flow
hooks itself (the editor already owns `setNodes`, which keeps concerns
separated per `code-standards.md`).

- Props: `{ onAdd: (category: NodeCategory) => void }`.
- Render one button per `NODE_CATEGORIES` entry, in order, using the
  icon and label from §2's `ICONS` / `CATEGORY_LABEL`:
  ```tsx
  <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2
                  flex max-w-[calc(100%-2rem)] flex-wrap items-center
                  justify-center gap-1 rounded-md border border-border
                  bg-card p-1 shadow-sm">
    {NODE_CATEGORIES.map((cat) => {
      const Icon = ICONS[cat]
      const iconClass = STYLES[cat].icon
      return (
        <Button key={cat} variant="ghost" size="sm"
                aria-label={`Add ${CATEGORY_LABEL[cat]}`}
                onClick={() => onAdd(cat)}>
          <Icon className={cn("h-4 w-4", iconClass)} strokeWidth={1.5} />
          <span className="text-xs font-medium">{CATEGORY_LABEL[cat]}</span>
        </Button>
      )
    })}
  </div>
  ```
- Export `ICONS` / `STYLES` from `smart-node.tsx` (or lift both into a
  small `nodes/node-style.ts`) so the toolbar and the node body share
  one map — do not fork the color/icon assignment.

### 6. `components/canvas/board-editor.tsx` — spawn wiring

Existing file. Small additions:

- Recover `setNodes` from `useNodesState` (Unit 07 dropped it as
  unused; this unit needs it):
  ```ts
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(initialSnapshot.nodes)
  ```
- Add a spawn handler using the swimlane helper:
  ```ts
  const handleAddNode = React.useCallback((category: NodeCategory) => {
    setNodes((current) => {
      const position = nextLanePosition(category, current)
      const newNode: BoardNode = {
        id: createNodeId(),
        type: category,
        position,
        data: { category, label: CATEGORY_LABEL[category] } satisfies SmartNodeData,
      }
      return [...current, newNode]
    })
    markDirty()
  }, [setNodes])
  ```
  Default label = the category name (e.g., "Database") — users can't
  rename yet; renaming lives in Unit 09's property panel scope (or a
  future one). This is deliberately the smallest useful default so
  toolbar-added and AI-added nodes both render the same way.
- Render the toolbar inside the children slot so it sits above the
  canvas but shares its viewport:
  ```tsx
  {() => (
    <div className="relative h-full w-full">
      <BoardCanvas {...canvasProps} />
      <AddNodeToolbar onAdd={handleAddNode} />
    </div>
  )}
  ```
  The wrapper is `relative` so the toolbar's `absolute` positioning
  anchors to it rather than escaping to the shell.

### 7. Persisted node validation — leave `nodeSchema` permissive

Do **not** tighten `canvasSnapshotSchema` to require `smartNodeDataSchema`
for every node — the schema still needs to accept:

- Nodes with unknown `type` (forward compat / mid-migration boards).
- Default-shape nodes from Unit 07 (an empty board never has any, but a
  hand-edited JSONB column might).
- Nodes the AI might briefly add before Unit 12's Zod pass runs
  client-side.

Validation happens *inside* `SmartNode` (§2) — malformed `data`
returns `null` rather than crashing the canvas. This matches
`code-standards.md`: "Validate unknown external input at system
boundaries before trusting it" — the boundary is the render step.

### 8. No changes to the Save action

`saveCanvas` in `app/editor/[projectId]/actions.ts` already writes
whatever `{ nodes, edges }` the client sends via the loose
`canvasSnapshotSchema`. New nodes carry a `type` string and a `data`
object with `category` / `label` — both keys are covered by the
existing loose schema (unknown keys are preserved). No migration and
no server change required in this unit.

## Dependencies

- No new npm packages. All required libs are installed:
  - `@xyflow/react` (Unit 07) — `Handle`, `Position`, `NodeProps`,
    `useNodesState.setNodes`.
  - `lucide-react` (Unit 01) — the six category icons.
  - `zod` (Unit 06) — `smartNodeDataSchema` for boundary validation.
  - `cn` (Unit 01) — class composition.
  - shadcn `Button` (Unit 01) — toolbar buttons.

## Verify when done

- [ ] The six `--node-*` and `--node-*-bg` CSS variables exist under
      both `:root` and `.dark`, and are mapped in `@theme inline` so
      `bg-node-database-bg`, `text-node-database`, `border-node-lb`,
      etc. resolve to the correct colors in the built CSS.
- [ ] `/editor/[projectId]` shows a floating 6-icon toolbar centered at
      the bottom of the canvas, above React Flow's zoom controls.
- [ ] Clicking each toolbar icon spawns exactly one node of that
      category into its designated column (`client` far left →
      `database` far right), with the correct border, ~15%-opacity
      fill, category icon, and default label.
- [ ] Repeated clicks on the same category stack nodes downward in that
      column with a consistent gap — no two nodes overlap in the same
      lane.
- [ ] Spawning across different categories never overlaps (columns
      never touch horizontally regardless of how many nodes each lane
      has).
- [ ] A spawned node is draggable, selectable (border thickens and
      shifts to `--accent-primary`), and exposes a source handle on the
      right and a target handle on the left (visible as small dots on
      hover; edges wire in Unit 09).
- [ ] Adding a node marks the board dirty; **Save** persists nodes to
      `Project.canvas`; a full page reload rehydrates each node with
      its correct `type`, category color, icon, and label.
- [ ] A saved node whose `data` is manually corrupted in Postgres
      (e.g., missing `category`) causes only that node to render as
      nothing — the canvas itself still loads and the other nodes
      render normally (no crash).
- [ ] The toolbar's `z-30` keeps it under the project sidebar (`z-40`)
      and dialogs (`z-50`); opening the sidebar covers the toolbar
      cleanly with no visual bleed.
- [ ] `nextLanePosition` is a pure function of `(category, nodes)`:
      calling it twice with the same inputs returns the same
      `{ x, y }`; it does not read from React Flow state or globals.
- [ ] The `--node-*` palette is not used anywhere outside
      `components/canvas/`.
- [ ] No TypeScript errors (`SmartNodeData` inferred from Zod; no
      `any`; `nodeTypes` typed via `@xyflow/react`).
- [ ] No console errors, no React Flow "nodeTypes changed" warning
      (the map is module-level), no Tailwind purge warning about
      unknown classes.
- [ ] Responsive at mobile and desktop: the toolbar stays centered
      and never overflows the viewport — on narrow screens the buttons
      wrap into a second row via `flex-wrap` + `max-w-[calc(100%-2rem)]`
      rather than clipping, and the whole toolbar stays centered as it
      grows taller.
- [ ] `npm run build` passes.
