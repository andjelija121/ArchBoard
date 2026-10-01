"use client"

import * as React from "react"
import {
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStoreApi,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react"
import { AlertCircle, Check, Circle, Loader2, Save } from "lucide-react"
import { cn } from "cn"

import { saveCanvas } from "@/app/editor/[projectId]/actions"
import { AddNodeToolbar } from "@/components/canvas/add-node-toolbar"
import { BoardCanvas } from "@/components/canvas/board-canvas"
import {
  PropertyPanel,
  type PropertyPanelSelection,
} from "@/components/canvas/property-panel"
import { EditorShell } from "@/components/editor/editor-shell"
import { Button } from "@/components/ui/button"
import {
  ANNOTATED_EDGE_TYPE,
  CATEGORY_LABEL,
  DEFAULT_EDGE_DATA,
  createEdgeId,
  createNodeId,
  nextLanePosition,
  type AnnotatedEdgeData,
  type BoardEdge,
  type BoardNode,
  type CanvasSnapshot,
  type NodeCategory,
  type SmartNodeData,
} from "@/lib/canvas"
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

// Screen-space margin (px) kept around a revealed node. The bottom is larger
// so the node clears the floating add-node toolbar.
const REVEAL_PADDING = { left: 48, right: 48, top: 48, bottom: 96 }
const REVEAL_DURATION_MS = 200

/** Shift needed to pull [start, end] inside [min, max]; 0 when already inside. */
function shiftIntoRange(start: number, end: number, min: number, max: number) {
  if (start < min) return min - start
  if (end > max) return max - end
  return 0
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
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(
    initialSnapshot.nodes
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>(
    initialSnapshot.edges
  )
  const [selection, setSelection] = React.useState<{
    kind: "edge" | "node"
    id: string
  } | null>(null)
  const [status, setStatus] = React.useState<SaveStatusValue>("clean")
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()
  // Bumped on every real edit so a save can tell if edits landed mid-flight.
  const editVersion = React.useRef(0)
  const { getViewport, setViewport } = useReactFlow()
  const store = useStoreApi()
  // A node just added from the toolbar, waiting for its first measurement.
  const pendingReveal = React.useRef<{
    id: string
    x: number
    y: number
  } | null>(null)

  const markDirty = () => {
    editVersion.current += 1
    setStatus("dirty")
  }

  // Pans the minimum distance needed to bring a measured node fully on screen.
  const revealNode = (
    node: { x: number; y: number },
    size: { width: number; height: number }
  ) => {
    const { width: viewWidth, height: viewHeight } = store.getState()
    const { x: vx, y: vy, zoom } = getViewport()
    const left = node.x * zoom + vx
    const top = node.y * zoom + vy
    const dx = shiftIntoRange(
      left,
      left + size.width * zoom,
      REVEAL_PADDING.left,
      viewWidth - REVEAL_PADDING.right
    )
    const dy = shiftIntoRange(
      top,
      top + size.height * zoom,
      REVEAL_PADDING.top,
      viewHeight - REVEAL_PADDING.bottom
    )
    if (dx === 0 && dy === 0) return
    void setViewport(
      { x: vx + dx, y: vy + dy, zoom },
      { duration: REVEAL_DURATION_MS }
    )
  }

  // Selection and measured-size changes aren't edits.
  const handleNodesChange: OnNodesChange<BoardNode> = (changes) => {
    onNodesChange(changes)
    if (changes.some((c) => c.type !== "select" && c.type !== "dimensions")) {
      markDirty()
    }

    const pending = pendingReveal.current
    if (!pending) return
    for (const change of changes) {
      if (
        change.type === "dimensions" &&
        change.id === pending.id &&
        change.dimensions
      ) {
        pendingReveal.current = null
        revealNode(pending, change.dimensions)
        break
      }
    }
  }

  const handleEdgesChange: OnEdgesChange<BoardEdge> = (changes) => {
    onEdgesChange(changes)
    if (changes.some((c) => c.type !== "select")) markDirty()
  }

  const onConnect: OnConnect = (connection) => {
    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: createEdgeId(),
          type: ANNOTATED_EDGE_TYPE,
          data: { ...DEFAULT_EDGE_DATA },
        },
        current
      )
    )
    markDirty()
  }

  // Closing the panel also drops React Flow's own highlight so the two agree.
  const clearSelection = React.useCallback(() => {
    setSelection(null)
    setNodes((current) =>
      current.some((n) => n.selected)
        ? current.map((n) => (n.selected ? { ...n, selected: false } : n))
        : current
    )
    setEdges((current) =>
      current.some((e) => e.selected)
        ? current.map((e) => (e.selected ? { ...e, selected: false } : e))
        : current
    )
  }, [setNodes, setEdges])

  const hasSelection = selection !== null
  React.useEffect(() => {
    if (!hasSelection) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) clearSelection()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [hasSelection, clearSelection])

  const handleEdgeClick = (_: React.MouseEvent, edge: BoardEdge) =>
    setSelection({ kind: "edge", id: edge.id })
  const handleNodeClick = (_: React.MouseEvent, node: BoardNode) =>
    setSelection({ kind: "node", id: node.id })
  const handlePaneClick = () => setSelection(null)

  const updateEdgeData = (patch: Partial<AnnotatedEdgeData>) => {
    if (selection?.kind !== "edge") return
    setEdges((current) =>
      current.map((e) =>
        e.id === selection.id ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
    markDirty()
  }

  const updateNodeData = (patch: Partial<SmartNodeData>) => {
    if (selection?.kind !== "node") return
    setNodes((current) =>
      current.map((n) =>
        n.id === selection.id ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
    markDirty()
  }

  // Resolved from live state so the panel tracks edits, and unmounts on its
  // own if the selected element is deleted.
  let panelSelection: PropertyPanelSelection | null = null
  if (selection?.kind === "edge") {
    const edge = edges.find((e) => e.id === selection.id)
    if (edge) panelSelection = { kind: "edge", edge }
  } else if (selection?.kind === "node") {
    const node = nodes.find((n) => n.id === selection.id)
    if (node) panelSelection = { kind: "node", node }
  }

  const handleAddNode = (category: NodeCategory) => {
    const data: SmartNodeData = { category, label: CATEGORY_LABEL[category] }
    const id = createNodeId()
    const position = nextLanePosition(category, nodes)
    pendingReveal.current = { id, ...position }
    setNodes((current) => [
      ...current,
      { id, type: category, position, data },
    ])
    markDirty()
  }

  const handleSave = () => {
    if (isPending || status === "saving" || status === "clean") return
    startTransition(async () => {
      const savedVersion = editVersion.current
      setStatus("saving")
      setSaveError(null)
      const result = await saveCanvas({
        projectId,
        snapshot: { nodes, edges },
      })
      if (result.ok) {
        // Edits made while saving aren't in the saved snapshot; stay dirty.
        setStatus(editVersion.current === savedVersion ? "saved" : "dirty")
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
        <div className="relative h-full w-full">
          <BoardCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onEdgeClick={handleEdgeClick}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
          />
          <AddNodeToolbar onAdd={handleAddNode} />
          {panelSelection && (
            <PropertyPanel
              selection={panelSelection}
              onEdgeDataChange={updateEdgeData}
              onNodeDataChange={updateNodeData}
              onClose={clearSelection}
            />
          )}
        </div>
      )}
    </EditorShell>
  )
}
