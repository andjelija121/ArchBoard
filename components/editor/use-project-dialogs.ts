import * as React from "react"

import {
  createProject,
  deleteProject,
  renameProject,
} from "@/app/editor/actions"
import { slugify, type ProjectListItem } from "@/lib/projects"

type DialogKind = "create" | "rename" | "delete" | null

/**
 * Owns dialog state, form state, error state, and pending state for the
 * create / rename / delete project flows. The project list itself lives on
 * the server; mutations go through Server Actions, which revalidate
 * `/editor` so the list refetches.
 */
export function useProjectDialogs() {
  const [dialog, setDialog] = React.useState<DialogKind>(null)
  const [activeProject, setActiveProject] =
    React.useState<ProjectListItem | null>(null)
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, startTransition] = React.useTransition()
  const dialogSessionId = React.useRef(0)

  const closeDialog = React.useCallback(() => {
    dialogSessionId.current += 1
    setDialog(null)
    setActiveProject(null)
    setName("")
    setError(null)
  }, [])

  const openCreateDialog = React.useCallback(() => {
    dialogSessionId.current += 1
    setActiveProject(null)
    setName("")
    setError(null)
    setDialog("create")
  }, [])

  const openRenameDialog = React.useCallback((project: ProjectListItem) => {
    dialogSessionId.current += 1
    setActiveProject(project)
    setName(project.name)
    setError(null)
    setDialog("rename")
  }, [])

  const openDeleteDialog = React.useCallback((project: ProjectListItem) => {
    dialogSessionId.current += 1
    setActiveProject(project)
    setError(null)
    setDialog("delete")
  }, [])

  const slugPreview = React.useMemo(() => slugify(name), [name])

  const submitCreate = React.useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed || isSubmitting) return

    const submittedSessionId = dialogSessionId.current
    setError(null)
    startTransition(async () => {
      const result = await createProject({ name: trimmed })
      if (dialogSessionId.current !== submittedSessionId) return
      if (result.ok) closeDialog()
      else setError(result.error)
    })
  }, [name, isSubmitting, closeDialog])

  const submitRename = React.useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed || !activeProject || isSubmitting) return

    const submittedSessionId = dialogSessionId.current
    setError(null)
    startTransition(async () => {
      const result = await renameProject({ id: activeProject.id, name: trimmed })
      if (dialogSessionId.current !== submittedSessionId) return
      if (result.ok) closeDialog()
      else setError(result.error)
    })
  }, [name, activeProject, isSubmitting, closeDialog])

  const submitDelete = React.useCallback(() => {
    if (!activeProject || isSubmitting) return

    const submittedSessionId = dialogSessionId.current
    setError(null)
    startTransition(async () => {
      const result = await deleteProject({ id: activeProject.id })
      if (dialogSessionId.current !== submittedSessionId) return
      if (result.ok) closeDialog()
      else setError(result.error)
    })
  }, [activeProject, isSubmitting, closeDialog])

  return {
    dialog,
    activeProject,
    name,
    setName,
    slugPreview,
    error,
    isSubmitting,
    openCreateDialog,
    openRenameDialog,
    openDeleteDialog,
    closeDialog,
    submitCreate,
    submitRename,
    submitDelete,
  }
}

export type UseProjectDialogsReturn = ReturnType<typeof useProjectDialogs>
