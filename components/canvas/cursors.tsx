"use client"

import { ViewportPortal, useStore } from "@xyflow/react"

import { useOther, useOthersConnectionIds } from "@/liveblocks.config"

function Cursor({ connectionId }: { connectionId: number }) {
  const presence = useOther(connectionId, (other) => other.presence)
  // Counter-scale so the pointer stays the same size at any zoom level.
  const zoom = useStore((state) => state.transform[2])
  if (!presence.cursor) return null

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-30 origin-top-left"
      style={{
        transform: `translate(${presence.cursor.x}px, ${presence.cursor.y}px) scale(${1 / zoom})`,
        color: presence.color,
      }}
    >
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M1 1v15.5l4.2-4 2.9 6.5 2.6-1.2-2.9-6.4H14L1 1z" />
      </svg>
      <span
        className="ml-3 block w-max max-w-40 truncate rounded-sm px-1.5 py-0.5 text-xs text-background"
        style={{ backgroundColor: presence.color }}
      >
        {presence.name}
      </span>
    </div>
  )
}

/**
 * Other participants' pointers. Rendered through ViewportPortal so they live
 * in canvas coordinates and follow pan and zoom.
 */
export function Cursors() {
  const connectionIds = useOthersConnectionIds()
  return (
    <ViewportPortal>
      {connectionIds.map((id) => (
        <Cursor key={id} connectionId={id} />
      ))}
    </ViewportPortal>
  )
}
