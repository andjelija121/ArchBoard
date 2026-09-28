"use client"

import * as React from "react"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"

interface EditorShellProps {
  children?: React.ReactNode
}

/**
 * Base chrome shared by every editor screen: top navbar + floating
 * project sidebar. Owns the open/closed state the two components share.
 */
export function EditorShell({ children }: EditorShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const sidebarToggleRef = React.useRef<HTMLButtonElement>(null)

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
    sidebarToggleRef.current?.focus()
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        sidebarToggleRef={sidebarToggleRef}
      />

      <div className="relative flex-1 overflow-hidden bg-background">
        {children}
      </div>

      <ProjectSidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
    </div>
  )
}
