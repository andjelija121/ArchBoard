"use client"

import * as React from "react"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import { EditorHome } from "@/components/editor/editor-home"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import {
  CreateProjectDialog,
  DeleteProjectDialog,
  RenameProjectDialog,
} from "@/components/editor/project-dialogs"
import { useProjectDialogs } from "@/components/editor/use-project-dialogs"
import { sharedProjects } from "@/lib/mock-projects"

interface EditorShellRenderProps {
  onNewProject: () => void
}

interface EditorShellProps {
  children?: (props: EditorShellRenderProps) => React.ReactNode
}

/**
 * Base chrome shared by every editor screen: top navbar + floating
 * project sidebar. Owns the open/closed state the two components share,
 * plus the create/rename/delete project dialog flow (mock data only).
 */
export function EditorShell({ children }: EditorShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const sidebarToggleRef = React.useRef<HTMLButtonElement>(null)

  const {
    ownedProjects,
    dialog,
    activeProject,
    name,
    setName,
    slugPreview,
    isSubmitting,
    openCreateDialog,
    openRenameDialog,
    openDeleteDialog,
    closeDialog,
    submitCreate,
    submitRename,
    submitDelete,
  } = useProjectDialogs()

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
        {children ? (
          children({ onNewProject: openCreateDialog })
        ) : (
          <EditorHome onNewProject={openCreateDialog} />
        )}
      </div>

      <ProjectSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        ownedProjects={ownedProjects}
        sharedProjects={sharedProjects}
        onCreateProject={openCreateDialog}
        onRenameProject={openRenameDialog}
        onDeleteProject={openDeleteDialog}
      />

      <CreateProjectDialog
        open={dialog === "create"}
        name={name}
        slugPreview={slugPreview}
        isSubmitting={isSubmitting}
        onNameChange={setName}
        onOpenChange={(open) => (open ? openCreateDialog() : closeDialog())}
        onSubmit={submitCreate}
      />

      <RenameProjectDialog
        open={dialog === "rename"}
        project={activeProject}
        name={name}
        isSubmitting={isSubmitting}
        onNameChange={setName}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        onSubmit={submitRename}
      />

      <DeleteProjectDialog
        open={dialog === "delete"}
        project={activeProject}
        isSubmitting={isSubmitting}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        onSubmit={submitDelete}
      />
    </div>
  )
}
