"use client"

import * as React from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  useStoreApi,
  type EdgeProps,
} from "@xyflow/react"

import { EdgeClickContext } from "@/components/canvas/edges/edge-click-context"
import {
  DEFAULT_EDGE_DATA,
  PROTOCOL_LABEL,
  annotatedEdgeDataSchema,
} from "@/lib/canvas"

const REST_STROKE = "var(--border-strong)"
const SELECTED_STROKE = "var(--accent-primary)"
const ASYNC_DASH = "6 4"

function AnnotatedEdgeBase({
  id,
  data: rawData,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const onEdgeClick = React.useContext(EdgeClickContext)
  const { getEdge } = useReactFlow()
  const store = useStoreApi()

  const parsed = annotatedEdgeDataSchema.safeParse(rawData)
  const data = parsed.success ? parsed.data : DEFAULT_EDGE_DATA

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const stroke = selected ? SELECTED_STROKE : REST_STROKE
  // The arrowhead must follow the stroke color, which React Flow's shared
  // marker definitions can't do per selection state, so each edge owns one.
  const markerId = `annotated-arrow-${id}-${selected ? "selected" : "rest"}`

  const handleBadgeClick = (event: React.MouseEvent) => {
    const edge = getEdge(id)
    if (!edge) return
    store.getState().addSelectedEdges([id])
    onEdgeClick?.(event, edge)
  }

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth={12.5}
          markerHeight={12.5}
          viewBox="-10 -10 20 20"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX={0}
          refY={0}
        >
          <polyline
            points="-5,-4 0,0 -5,4 -5,-4"
            fill={stroke}
            stroke={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
          />
        </marker>
      </defs>
      <BaseEdge
        path={path}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke,
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: data.async ? ASYNC_DASH : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex cursor-pointer flex-col items-center rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          onClick={handleBadgeClick}
        >
          <span>{PROTOCOL_LABEL[data.protocol]}</span>
          {data.apiRoute && (
            <span className="max-w-32 truncate text-text-subtle">
              {data.apiRoute}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const AnnotatedEdge = React.memo(AnnotatedEdgeBase)
