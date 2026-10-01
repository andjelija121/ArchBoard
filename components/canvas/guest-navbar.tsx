import Link from "next/link"

import { Button } from "@/components/ui/button"

interface GuestNavbarProps {
  title: string
  canEdit: boolean
}

/**
 * Navbar for anonymous share-link guests: title, role pill and a Sign in link.
 * No project sidebar, AI toggle, Share or Save, and no Clerk session to show.
 */
export function GuestNavbar({ title, canEdit }: GuestNavbarProps) {
  return (
    <nav className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="min-w-0 truncate text-sm font-medium text-foreground">
          {title}
        </h1>
        <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
          {canEdit ? "Shared · edit" : "Shared · view"}
        </span>
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link href="/">Sign in</Link>
      </Button>
    </nav>
  )
}
