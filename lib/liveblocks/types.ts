import type { JsonObject } from "@liveblocks/client"

/**
 * The shape of a node/edge inside Liveblocks Storage: a React Flow element
 * minus its per-user fields (selection, measured size, drag/resize flags).
 * Those stay local, so one user's selection never leaks to another.
 */
export type StoredNode = {
  id: string
  type?: string
  position: { x: number; y: number }
  data: JsonObject
  width?: number
  height?: number
  zIndex?: number
}

export type StoredEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  data?: JsonObject
}

export type CursorPosition = { x: number; y: number }
