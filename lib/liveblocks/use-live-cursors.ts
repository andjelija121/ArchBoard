"use client"

import * as React from "react"
import { useReactFlow } from "@xyflow/react"

import { useSelf, useUpdateMyPresence } from "@/liveblocks.config"

// Reuses the canvas-only --group-* tokens plus the accent. Stored in presence
// as CSS values, so every client paints a participant the same color.
const CURSOR_COLORS = [
  "var(--group-slate)",
  "var(--group-cyan)",
  "var(--group-amber)",
  "var(--group-green)",
  "var(--group-purple)",
  "var(--accent-primary)",
] as const

const GUEST_NAME = "Guest"

/** Round-robin by connection id: stable for the whole session. */
export function cursorColor(connectionId: number): string {
  return CURSOR_COLORS[connectionId % CURSOR_COLORS.length]
}

/** Broadcasts the local pointer, in canvas space, through Liveblocks Presence. */
export function useLiveCursors() {
  const updateMyPresence = useUpdateMyPresence()
  const { screenToFlowPosition } = useReactFlow()
  const connectionId = useSelf((me) => me.connectionId)
  const name = useSelf((me) => me.info?.name)

  React.useEffect(() => {
    updateMyPresence({
      name: name ?? GUEST_NAME,
      color: cursorColor(connectionId),
    })
  }, [updateMyPresence, name, connectionId])

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent) => {
      updateMyPresence({
        cursor: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      })
    },
    [updateMyPresence, screenToFlowPosition]
  )

  const onPointerLeave = React.useCallback(() => {
    updateMyPresence({ cursor: null })
  }, [updateMyPresence])

  return { onPointerMove, onPointerLeave }
}
