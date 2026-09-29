import { clerkMiddleware } from "@clerk/nextjs/server"

// Route protection lives in each page/layout via `auth.protect()` (resource-based
// auth), not here. This middleware only makes `auth()`/`auth.protect()` available
// on the server — see https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher
export default clerkMiddleware()

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
