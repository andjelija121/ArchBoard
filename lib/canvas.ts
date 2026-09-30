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

export const canvasSnapshotSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
})

/** Validates untrusted JSON; a null or malformed column is an empty board. */
export function parseCanvas(value: unknown): CanvasSnapshot {
  if (value === null || value === undefined) return EMPTY_SNAPSHOT
  const result = canvasSnapshotSchema.safeParse(value)
  return result.success ? (result.data as CanvasSnapshot) : EMPTY_SNAPSHOT
}
