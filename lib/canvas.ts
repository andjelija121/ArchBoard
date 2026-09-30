import type { Edge, Node } from "@xyflow/react"
import { z } from "zod"

export type BoardNode = Node
export type BoardEdge = Edge

export interface CanvasSnapshot {
  nodes: BoardNode[]
  edges: BoardEdge[]
}

export const EMPTY_SNAPSHOT: CanvasSnapshot = { nodes: [], edges: [] }

const positionSchema = z.object({ x: z.number(), y: z.number() })

// Loose objects keep unknown keys (React Flow attaches many) so data added by
// later units survives a save/load round-trip.
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

const MAX_NODES = 2000
const MAX_EDGES = 5000

export const canvasSnapshotSchema = z.object({
  nodes: z.array(nodeSchema).max(MAX_NODES, "Too many nodes on the board."),
  edges: z.array(edgeSchema).max(MAX_EDGES, "Too many edges on the board."),
})

// Left-to-right swimlane order: clients first, data layer last.
export const NODE_CATEGORIES = [
  "client",
  "lb",
  "compute",
  "cache",
  "queue",
  "database",
] as const

export type NodeCategory = (typeof NODE_CATEGORIES)[number]

export const SWIMLANE_ORDER: readonly NodeCategory[] = NODE_CATEGORIES

export const CATEGORY_LABEL: Record<NodeCategory, string> = {
  client: "Client",
  lb: "Load Balancer",
  compute: "Compute",
  cache: "Cache",
  queue: "Queue / Broker",
  database: "Database",
}

// NODE_WIDTH matches Tailwind's w-44 and NODE_HEIGHT its min-h-14.
export const NODE_WIDTH = 176
export const NODE_HEIGHT = 56
export const COLUMN_GAP = 80
export const COLUMN_STEP = NODE_WIDTH + COLUMN_GAP
export const ROW_HEIGHT = NODE_HEIGHT + 24
export const LANE_TOP = 40

/** The `data` payload of every smart node; Unit 12's AI output must match it. */
export const smartNodeDataSchema = z.object({
  category: z.enum(NODE_CATEGORIES),
  label: z.string().min(1).max(80),
  subLabel: z.string().max(80).optional(),
})

export type SmartNodeData = z.infer<typeof smartNodeDataSchema>

export interface SpawnPlacement {
  x: number
  y: number
}

interface PositionedNode {
  position: { x: number; y: number }
  data?: unknown
}

/** Column X for the category, and the first free row below that lane's nodes. */
export function nextLanePosition(
  category: NodeCategory,
  existingNodes: readonly PositionedNode[]
): SpawnPlacement {
  const x = SWIMLANE_ORDER.indexOf(category) * COLUMN_STEP
  const laneYs = existingNodes
    .filter(
      (node) =>
        (node.data as { category?: unknown } | undefined)?.category ===
        category
    )
    .map((node) => node.position.y)
  const y = laneYs.length === 0 ? LANE_TOP : Math.max(...laneYs) + ROW_HEIGHT
  return { x, y }
}

export function createNodeId(): string {
  return `n_${crypto.randomUUID()}`
}

/** Validates untrusted JSON; a null or malformed column is an empty board. */
export function parseCanvas(value: unknown): CanvasSnapshot {
  if (value === null || value === undefined) return EMPTY_SNAPSHOT
  const result = canvasSnapshotSchema.safeParse(value)
  if (!result.success) {
    console.error("parseCanvas: invalid canvas JSON", result.error)
    return EMPTY_SNAPSHOT
  }
  return result.data as CanvasSnapshot
}
