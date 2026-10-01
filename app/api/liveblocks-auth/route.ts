import { auth, currentUser } from "@clerk/nextjs/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"

const AUTHORIZE_USER_URL = "https://api.liveblocks.io/v2/authorize-user"

const bodySchema = z.object({ room: z.string().min(1) })

/**
 * Mints a Liveblocks access token for one room. Today only the authenticated
 * owner of the board may join; guest share links extend this in Unit 14.
 * (Liveblocks requires an endpoint URL here, so this is a route handler
 * rather than a Server Action.)
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return new Response("Unauthorized", { status: 401 })

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

  // Room id is the project id; the owner-scoped lookup is the access check.
  const project = await prisma.project.findFirst({
    where: { id: room, ownerId: userId },
    select: { id: true },
  })
  if (!project) return new Response("Forbidden", { status: 403 })

  const user = await currentUser()
  const name = user?.firstName?.trim() || "User"

  try {
    const response = await fetch(AUTHORIZE_USER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        userInfo: { name },
        permissions: { [room]: ["room:write"] },
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
