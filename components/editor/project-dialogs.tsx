"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DialogPattern } from "@/components/editor/dialog-pattern"
import type { ProjectListItem } from "@/lib/projects"

function ErrorLine({ error }: { error?: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="text-xs text-destructive">
      {error}
    </p>
  )
}

interface CreateProjectDialogProps {
  open: boolean
  name: string
  slugPreview: string
  error?: string | null
  isSubmitting: boolean
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}

export function CreateProjectDialog({
  open,
  name,
  slugPreview,
  error,
  isSubmitting,
  onNameChange,
  onOpenChange,
  onSubmit,
}: CreateProjectDialogProps) {
  return (
    <DialogPattern
      open={open}
      onOpenChange={onOpenChange}
      title="Create project"
      description="Start a new architecture workspace."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Input
          autoFocus
          placeholder="Project name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {slugPreview ? `/${slugPreview}` : "Enter a name to preview the slug."}
        </p>
        <ErrorLine error={error} />
      </form>
    </DialogPattern>
  )
}

interface RenameProjectDialogProps {
  open: boolean
  project: ProjectListItem | null
  name: string
  error?: string | null
  isSubmitting: boolean
  onNameChange: (name: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}

export function RenameProjectDialog({
  open,
  project,
  name,
  error,
  isSubmitting,
  onNameChange,
  onOpenChange,
  onSubmit,
}: RenameProjectDialogProps) {
  return (
    <DialogPattern
      open={open}
      onOpenChange={onOpenChange}
      title="Rename project"
      description={
        project ? `Currently named "${project.name}".` : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Input
          autoFocus
          placeholder="Project name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <ErrorLine error={error} />
      </form>
    </DialogPattern>
  )
}

interface DeleteProjectDialogProps {
  open: boolean
  project: ProjectListItem | null
  error?: string | null
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}

export function DeleteProjectDialog({
  open,
  project,
  error,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: DeleteProjectDialogProps) {
  return (
    <DialogPattern
      open={open}
      onOpenChange={onOpenChange}
      title="Delete project"
      description={
        project
          ? `This will permanently delete "${project.name}". This action cannot be undone.`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <ErrorLine error={error} />
    </DialogPattern>
  )
}
