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

export const MAX_GENERATED_NODES = 12
export const MAX_GENERATED_GROUPS = 6

export const generatedNodeSchema = smartNodeDataSchema
export type GeneratedNode = z.infer<typeof generatedNodeSchema>

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

export const EDGE_PROTOCOLS = ["rest", "grpc", "websocket"] as const

export type EdgeProtocol = (typeof EDGE_PROTOCOLS)[number]

export const PROTOCOL_LABEL: Record<EdgeProtocol, string> = {
  rest: "REST",
  grpc: "gRPC",
  websocket: "WebSocket",
}

export const ANNOTATED_EDGE_TYPE = "annotated"

/** The `data` payload of every annotated edge; validated where it is rendered. */
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

export const GROUP_NODE_TYPE = "group"

export function createGroupId(): string {
  return `g_${crypto.randomUUID()}`
}

export const GROUP_COLORS = ["slate", "cyan", "amber", "green", "purple"] as const

export type GroupColor = (typeof GROUP_COLORS)[number]

export const DEFAULT_GROUP_COLOR: GroupColor = "slate"

export const GROUP_PADDING = 24 // gap between members and the box edge
export const GROUP_HEADER = 28 // extra top room for the label chip
export const GROUP_MIN_WIDTH = 160
export const GROUP_MIN_HEIGHT = 120
// Negative so a box draws behind edges as well as its members.
export const GROUP_Z_INDEX = -1

export const DEFAULT_GROUP_LABEL = "Group"

/**
 * The `data` payload of a bounding box. Membership lives only here: members
 * keep absolute coordinates and never point back at the box.
 */
export const groupNodeDataSchema = z.object({
  label: z.string().min(1).max(80),
  color: z.enum(GROUP_COLORS).default(DEFAULT_GROUP_COLOR),
  childIds: z.array(z.string()).default([]),
})

export type GroupNodeData = z.infer<typeof groupNodeDataSchema>

export const generatedGroupSchema = z.object({
  label: z.string().min(1).max(80),
  color: z.enum(GROUP_COLORS).optional(),
  nodeIndices: z.array(z.number().int().min(0)).min(1),
})
export type GeneratedGroup = z.infer<typeof generatedGroupSchema>

export const generatedResultSchema = z.object({
  nodes: z
    .array(generatedNodeSchema)
    .min(1, "The model returned no nodes.")
    .max(MAX_GENERATED_NODES, "The model returned too many nodes."),
  groups: z
    .array(generatedGroupSchema)
    .max(MAX_GENERATED_GROUPS, "The model returned too many groups.")
    .optional()
    .default([]),
})
export type GeneratedResult = z.infer<typeof generatedResultSchema>

export const generatedNodesSchema = z
  .array(generatedNodeSchema)
  .min(1, "The model returned no nodes.")
  .max(MAX_GENERATED_NODES, "The model returned too many nodes.")

export type GeneratedNodes = z.infer<typeof generatedNodesSchema>

export interface GroupBounds {
  x: number
  y: number
  width: number
  height: number
}

interface MeasuredNode {
  position: { x: number; y: number }
  measured?: { width?: number; height?: number }
}

/** Smallest box (with padding and header room) enclosing the members. */
export function computeGroupBounds(
  members: readonly MeasuredNode[]
): GroupBounds {
  const rects = members.map((node) => ({
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? NODE_WIDTH,
    height: node.measured?.height ?? NODE_HEIGHT,
  }))
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))
  return {
    x: minX - GROUP_PADDING,
    y: minY - GROUP_PADDING - GROUP_HEADER,
    width: maxX - minX + GROUP_PADDING * 2,
    height: maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER,
  }
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
