"use client"

import * as React from "react"
import { UserButton } from "@clerk/nextjs"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

const subscribeNoop = () => () => {}

// Clerk's UserButton renders nothing until clerk-js has loaded. On the server
// that is always true, but on the client clerk-js can finish before hydration,
// so the first client render would add markup the server never sent. Rendering
// it only after hydration keeps both renders identical.
function ClientUserButton() {
  const isClient = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
  return isClient ? (
    <UserButton />
  ) : (
    <span aria-hidden className="size-7 shrink-0" />
  )
}

interface EditorNavbarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  sidebarToggleRef?: React.Ref<HTMLButtonElement>
  centerSlot?: React.ReactNode
  actionsSlot?: React.ReactNode
  className?: string
}

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
  sidebarToggleRef,
  centerSlot,
  actionsSlot,
  className,
}: EditorNavbarProps) {
  return (
    <nav
      className={cn(
        "flex h-12 shrink-0 items-center border-b border-border bg-card px-3",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-2">
        <Button
          ref={sidebarToggleRef}
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center px-2">
        {centerSlot}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        {actionsSlot}
        <ClientUserButton />
      </div>
    </nav>
  )
}
