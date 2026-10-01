"use client"

import * as React from "react"
import { ClientSideSuspense } from "@liveblocks/react"
import { LiveList, LiveObject } from "@liveblocks/client"
import { AlertCircle, Loader2 } from "lucide-react"

import type { CanvasSnapshot } from "@/lib/canvas"
import { RoomProvider } from "@/liveblocks.config"

import { toStoredEdge, toStoredNode } from "./canvas-sync"

interface LiveRoomProps {
  roomId: string
  initialSnapshot: CanvasSnapshot
  children: React.ReactNode
}

function RoomMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** A failed connection or auth call throws inside the Suspense hooks. */
class RoomErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("Liveblocks room failed", error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <RoomMessage>
        <AlertCircle
          className="h-8 w-8 text-state-error"
          strokeWidth={1.5}
        />
        <p>Couldn&apos;t connect to the live session. Reload to try again.</p>
      </RoomMessage>
    )
  }
}

/**
 * Joins the board's Liveblocks room and renders the children once Storage has
 * loaded. `initialStorage` seeds the room only if it is empty; otherwise the
 * live state wins over the Postgres snapshot.
 */
export function LiveRoom({ roomId, initialSnapshot, children }: LiveRoomProps) {
  return (
    <RoomProvider
      id={roomId}
      initialPresence={{ cursor: null, name: "", color: "" }}
      initialStorage={() => ({
        nodes: new LiveList(
          initialSnapshot.nodes.map((n) => new LiveObject(toStoredNode(n)))
        ),
        edges: new LiveList(
          initialSnapshot.edges.map((e) => new LiveObject(toStoredEdge(e)))
        ),
      })}
    >
      <RoomErrorBoundary>
        <ClientSideSuspense
          fallback={
            <RoomMessage>
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
              <p>Connecting…</p>
            </RoomMessage>
          }
        >
          {children}
        </ClientSideSuspense>
      </RoomErrorBoundary>
    </RoomProvider>
  )
}
