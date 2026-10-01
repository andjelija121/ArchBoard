"use client"

import * as React from "react"

import type { BoardEdge } from "@/lib/canvas"

type EdgeClickHandler = (event: React.MouseEvent, edge: BoardEdge) => void

/**
 * Edge label badges render in a portal outside React Flow's edge SVG, so
 * clicks on them never reach `onEdgeClick`. BoardCanvas provides the same
 * handler here and the badge relays its own click through it.
 */
export const EdgeClickContext = React.createContext<EdgeClickHandler | null>(
  null
)
