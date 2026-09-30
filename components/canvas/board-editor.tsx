"use client"

import * as React from "react"
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react"
import { AlertCircle, Check, Circle, Loader2, Save } from "lucide-react"
import { cn } from "cn"

import { saveCanvas } from "@/app/editor/[projectId]/actions"
import { BoardCanvas } from "@/components/canvas/board-canvas"
import { EditorShell } from "@/components/editor/editor-shell"
import { Button } from "@/components/ui/button"
import type { BoardEdge, BoardNode, CanvasSnapshot } from "@/lib/canvas"
import type { ProjectListItem } from "@/lib/projects"

type SaveStatusValue = "clean" | "dirty" | "saving" | "saved" | "error"

interface BoardEditorProps {
  projectId: string
  projectName: string
  initialSnapshot: CanvasSnapshot
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
}

const STATUS_DISPLAY: Record<
  SaveStatusValue,
  { icon: React.ElementType; label: string; className: string; spin?: boolean }
> = {
  clean: { icon: Check, label: "Saved", className: "text-text-subtle" },
  dirty: { icon: Circle, label: "Unsaved", className: "text-state-warning" },
  saving: {
    icon: Loader2,
    label: "Saving…",
    className: "text-muted-foreground",
    spin: true,
  },
  saved: { icon: Check, label: "Saved", className: "text-state-success" },
  error: {
    icon: AlertCircle,
    label: "Save failed",
    className: "text-state-error",
  },
}

function BoardTitle({ name }: { name: string }) {
  return (
    <h1 className="max-w-full truncate text-sm font-medium text-foreground">
      {name}
    </h1>
  )
}

function SaveStatus({
  status,
  error,
}: {
  status: SaveStatusValue
  error: string | null
}) {
  const { icon: Icon, label, className, spin } = STATUS_DISPLAY[status]
  return (
    <div
      role="status"
      title={status === "error" && error ? error : undefined}
      className={cn("flex items-center gap-1.5 text-xs", className)}
    >
      <Icon
        className={cn("h-4 w-4", spin && "animate-spin")}
        strokeWidth={1.5}
      />
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}

/**
 * Board client shell: owns the live canvas state and the save lifecycle, and
 * injects the title and save controls into the shared editor chrome.
 */
export function BoardEditor(props: BoardEditorProps) {
  return (
    <ReactFlowProvider>
      <BoardEditorInner {...props} />
    </ReactFlowProvider>
  )
}

function BoardEditorInner({
  projectId,
  projectName,
  initialSnapshot,
  ownedProjects,
  sharedProjects,
}: BoardEditorProps) {
  const [nodes, , onNodesChange] = useNodesState<BoardNode>(
    initialSnapshot.nodes
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>(
    initialSnapshot.edges
  )
  const [status, setStatus] = React.useState<SaveStatusValue>("clean")
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()

  // Selection and measured-size changes aren't edits. Refine further in Unit 08.
  const handleNodesChange: OnNodesChange<BoardNode> = (changes) => {
    onNodesChange(changes)
    if (changes.some((c) => c.type !== "select" && c.type !== "dimensions")) {
      setStatus("dirty")
    }
  }

  const handleEdgesChange: OnEdgesChange<BoardEdge> = (changes) => {
    onEdgesChange(changes)
    if (changes.some((c) => c.type !== "select")) setStatus("dirty")
  }

  const onConnect: OnConnect = (connection) => {
    setEdges((current) => addEdge(connection, current))
    setStatus("dirty")
  }

  const handleSave = () => {
    if (isPending || status === "saving" || status === "clean") return
    startTransition(async () => {
      setStatus("saving")
      setSaveError(null)
      const result = await saveCanvas({
        projectId,
        snapshot: { nodes, edges },
      })
      if (result.ok) {
        setStatus("saved")
      } else {
        setStatus("error")
        setSaveError(result.error)
      }
    })
  }

  return (
    <EditorShell
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
      navbarCenter={<BoardTitle name={projectName} />}
      navbarActions={
        <>
          <SaveStatus status={status} error={saveError} />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || status === "clean" || status === "saved"}
          >
            <Save className="h-4 w-4" />
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {() => (
        <BoardCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
        />
      )}
    </EditorShell>
  )
}
