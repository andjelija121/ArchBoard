import { auth, currentUser } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { SHARE_TOKEN_COOKIE } from "@/lib/share"

const AUTHORIZE_USER_URL = "https://api.liveblocks.io/v2/authorize-user"

const bodySchema = z.object({ room: z.string().min(1) })

type RoomPermissions = readonly string[]

// A VIEW guest can read Storage and broadcast a cursor, but not mutate Storage.
const OWNER_PERMISSIONS: RoomPermissions = ["room:write"]
const EDIT_GUEST_PERMISSIONS: RoomPermissions = ["room:write"]
const VIEW_GUEST_PERMISSIONS: RoomPermissions = [
  "room:read",
  "room:presence:write",
]

interface Identity {
  userId: string
  name: string
  permissions: RoomPermissions
}

/**
 * Who may join `room`, or the failing response. The signed-in owner joins
 * their own board; anyone else needs the share-token cookie of an active link
 * for exactly this room. (Liveblocks requires an endpoint URL here, so this is
 * a route handler rather than a Server Action.)
 */
async function resolveIdentity(
  room: string,
  userId: string | null
): Promise<Identity | Response> {
  if (userId) {
    // Room id is the project id; the owner-scoped lookup is the access check.
    const project = await prisma.project.findFirst({
      where: { id: room, ownerId: userId },
      select: { id: true },
    })
    if (project) {
      const user = await currentUser()
      return {
        userId,
        name: user?.firstName?.trim() || "User",
        permissions: OWNER_PERMISSIONS,
      }
    }
    // Signed in but not the owner (e.g. another account opening a share
    // link): fall through to the share-token check below.
  }

  const token = (await cookies()).get(SHARE_TOKEN_COOKIE)?.value
  if (!token) {
    return new Response(userId ? "Forbidden" : "Unauthorized", {
      status: userId ? 403 : 401,
    })
  }

  // A revoked link no longer matches, so a guest can't re-auth after revoke.
  const link = await prisma.shareLink.findFirst({
    where: { token, revokedAt: null },
    select: { role: true, projectId: true },
  })
  if (!link || link.projectId !== room) {
    return new Response("Forbidden", { status: 403 })
  }

  return {
    // Unique per session so guest cursors never collide.
    userId: `guest_${crypto.randomUUID()}`,
    name: "Guest",
    permissions:
      link.role === "EDIT" ? EDIT_GUEST_PERMISSIONS : VIEW_GUEST_PERMISSIONS,
  }
}

export async function POST(request: Request) {
  const { userId } = await auth()

  const secret = process.env.LIVEBLOCKS_SECRET_KEY
  if (!secret) {
    console.error("liveblocks-auth: LIVEBLOCKS_SECRET_KEY is not set")
    return new Response("Live collaboration is not configured.", {
      status: 500,
    })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new Response("Bad request", { status: 400 })
  const { room } = parsed.data

  const identity = await resolveIdentity(room, userId)
  if (identity instanceof Response) return identity

  try {
    const response = await fetch(AUTHORIZE_USER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: identity.userId,
        userInfo: { name: identity.name },
        permissions: { [room]: identity.permissions },
      }),
    })
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("liveblocks-auth: authorize-user request failed", error)
    return new Response("Could not reach Liveblocks.", { status: 503 })
  }
}
