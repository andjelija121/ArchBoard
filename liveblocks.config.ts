import { createClient, type LiveList, type LiveObject } from "@liveblocks/client"
import { createRoomContext } from "@liveblocks/react"

import type {
  CursorPosition,
  StoredEdge,
  StoredNode,
} from "@/lib/liveblocks/types"

export const liveblocksClient = createClient({
  authEndpoint: "/api/liveblocks-auth",
})

export type Presence = {
  cursor: CursorPosition | null // canvas-space pointer
  name: string // display name
  color: string // CSS color token from the cursor palette
}

export type Storage = {
  nodes: LiveList<LiveObject<StoredNode>>
  edges: LiveList<LiveObject<StoredEdge>>
}

export type UserMeta = {
  id: string
  info: { name: string }
}

// The Suspense flavor: `useStorage` never returns null, so callers don't
// each have to handle the loading state. <LiveRoom> owns the fallback.
export const {
  suspense: {
    RoomProvider,
    useOther,
    useOthersConnectionIds,
    useUpdateMyPresence,
    useStorage,
    useMutation,
    useSelf,
    useStatus,
  },
} = createRoomContext<Presence, Storage, UserMeta>(liveblocksClient)
