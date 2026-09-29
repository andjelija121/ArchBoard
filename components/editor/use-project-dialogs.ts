import * as React from "react"

import {
  initialOwnedProjects,
  slugify,
  type MockProject,
} from "@/lib/mock-projects"

type DialogKind = "create" | "rename" | "delete" | null

const MOCK_LATENCY_MS = 400

/**
 * Owns dialog state, form state, and loading state for the create /
 * rename / delete project flows. Mutates an in-memory mock project list —
 * no API calls or persistence per `04-project-dialogs.md`.
 */
export function useProjectDialogs() {
  const [ownedProjects, setOwnedProjects] = React.useState<MockProject[]>(
    initialOwnedProjects
  )
  const [dialog, setDialog] = React.useState<DialogKind>(null)
  const [activeProject, setActiveProject] = React.useState<MockProject | null>(
    null
  )
  const [name, setName] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const submissionVersionRef = React.useRef(0)
  const isSubmittingRef = React.useRef(false)

  const closeDialog = React.useCallback(() => {
    submissionVersionRef.current += 1
    isSubmittingRef.current = false
    setDialog(null)
    setActiveProject(null)
    setName("")
    setIsSubmitting(false)
  }, [])

  const openCreateDialog = React.useCallback(() => {
    setActiveProject(null)
    setName("")
    setDialog("create")
  }, [])

  const openRenameDialog = React.useCallback((project: MockProject) => {
    setActiveProject(project)
    setName(project.name)
    setDialog("rename")
  }, [])

  const openDeleteDialog = React.useCallback((project: MockProject) => {
    setActiveProject(project)
    setDialog("delete")
  }, [])

  const slugPreview = React.useMemo(() => slugify(name), [name])

  const submitCreate = React.useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || isSubmittingRef.current) return

    isSubmittingRef.current = true
    setIsSubmitting(true)
    submissionVersionRef.current += 1
    const version = submissionVersionRef.current

    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
    if (submissionVersionRef.current !== version) return

    const project: MockProject = {
      id: `proj-${Date.now()}`,
      name: trimmed,
      slug: slugify(trimmed),
      owner: true,
    }
    setOwnedProjects((projects) => [...projects, project])
    closeDialog()
  }, [name, closeDialog])

  const submitRename = React.useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || !activeProject || isSubmittingRef.current) return

    isSubmittingRef.current = true
    setIsSubmitting(true)
    submissionVersionRef.current += 1
    const version = submissionVersionRef.current

    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
    if (submissionVersionRef.current !== version) return

    setOwnedProjects((projects) =>
      projects.map((project) =>
        project.id === activeProject.id
          ? { ...project, name: trimmed, slug: slugify(trimmed) }
          : project
      )
    )
    closeDialog()
  }, [name, activeProject, closeDialog])

  const submitDelete = React.useCallback(async () => {
    if (!activeProject || isSubmittingRef.current) return

    isSubmittingRef.current = true
    setIsSubmitting(true)
    submissionVersionRef.current += 1
    const version = submissionVersionRef.current

    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
    if (submissionVersionRef.current !== version) return

    setOwnedProjects((projects) =>
      projects.filter((project) => project.id !== activeProject.id)
    )
    closeDialog()
  }, [activeProject, closeDialog])

  return {
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
  }
}

export type UseProjectDialogsReturn = ReturnType<typeof useProjectDialogs>
