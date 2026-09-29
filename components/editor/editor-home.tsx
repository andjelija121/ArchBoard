"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

interface EditorHomeProps {
  onNewProject: () => void
}

/**
 * Default `/editor` center content: shown until a specific board is open.
 */
export function EditorHome({ onNewProject }: EditorHomeProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        Create a project or open an existing one
      </h1>
      <p className="text-sm text-muted-foreground">
        Start a new architecture workspace, or choose a project from the
        sidebar.
      </p>
      <Button onClick={onNewProject}>
        <Plus className="h-4 w-4" />
        New Project
      </Button>
    </div>
  )
}
