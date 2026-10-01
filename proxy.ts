import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { SHARE_TOKEN_COOKIE } from "@/lib/share"

const SHARE_PATH = /^\/share\/([A-Za-z0-9_-]{1,64})\/?$/

// Route protection lives in each page/layout via `auth.protect()` (resource-based
// auth), not here. This middleware makes `auth()`/`auth.protect()` available
// on the server — see https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher
//
// It also hands a guest's share token to the Liveblocks auth endpoint: a Server
// Component can't write cookies while rendering, so the `/share/[token]` request
// sets it here. The cookie is only a claim; the auth endpoint checks it against
// an active ShareLink before granting anything.
export default clerkMiddleware((_auth, request) => {
  const token = SHARE_PATH.exec(request.nextUrl.pathname)?.[1]
  if (!token) return

  const response = NextResponse.next()
  response.cookies.set(SHARE_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  return response
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
