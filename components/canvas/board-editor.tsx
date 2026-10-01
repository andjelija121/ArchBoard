"use client"

import * as React from "react"
import {
  ReactFlowProvider,
  useReactFlow,
  useStoreApi,
  type OnConnect,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeFunc,
} from "@xyflow/react"
import { AlertCircle, Check, Circle, Loader2, Save, Sparkles } from "lucide-react"
import { cn } from "cn"

import { saveCanvas } from "@/app/editor/[projectId]/actions"
import { AiSidebar } from "@/components/ai/ai-sidebar"
import { useAiSidebar } from "@/components/ai/use-ai-sidebar"
import { AddNodeToolbar } from "@/components/canvas/add-node-toolbar"
import { BoardCanvas } from "@/components/canvas/board-canvas"
import { Cursors } from "@/components/canvas/cursors"
import { HelpButton } from "@/components/canvas/help-dialog"
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
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_LABEL,
  GROUP_NODE_TYPE,
  GROUP_Z_INDEX,
  computeGroupBounds,
  createEdgeId,
  createGroupId,
  createNodeId,
  groupNodeDataSchema,
  nextLanePosition,
  type AnnotatedEdgeData,
  type BoardEdge,
  type BoardNode,
  type CanvasSnapshot,
  type GeneratedResult,
  type GroupNodeData,
  type NodeCategory,
  type SmartNodeData,
} from "@/lib/canvas"
import { useLiveCanvas } from "@/lib/liveblocks/use-live-canvas"
import { useLiveCursors } from "@/lib/liveblocks/use-live-cursors"
import { LiveRoom } from "@/lib/liveblocks/room-provider"
import type { ProjectListItem } from "@/lib/projects"

type SaveStatusValue = "clean" | "dirty" | "saving" | "saved" | "error"

interface SelectedElement {
  kind: "edge" | "node" | "group"
  id: string
}

const selectedNodeElement = (node: BoardNode): SelectedElement => ({
  kind: node.type === GROUP_NODE_TYPE ? "group" : "node",
  id: node.id,
})

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

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
 * Board client shell: joins the board's Liveblocks room, owns the save
 * lifecycle, and injects the title and save controls into the shared editor
 * chrome. Canvas state itself lives in Liveblocks Storage while the room is open.
 */
export function BoardEditor(props: BoardEditorProps) {
  return (
    <LiveRoom roomId={props.projectId} initialSnapshot={props.initialSnapshot}>
      <ReactFlowProvider>
        <BoardEditorInner {...props} />
      </ReactFlowProvider>
    </LiveRoom>
  )
}

function BoardEditorInner({
  projectId,
  projectName,
  ownedProjects,
  sharedProjects,
}: BoardEditorProps) {
  const [selection, setSelection] = React.useState<SelectedElement | null>(
    null
  )
  // Selected smart nodes (never boxes): the set a new box would wrap.
  const [groupableIds, setGroupableIds] = React.useState<string[]>([])
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

  const markDirty = React.useCallback(() => {
    editVersion.current += 1
    setStatus("dirty")
  }, [])

  // Storage changes (ours or another client's) mark the board unsaved.
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    addEdge,
  } = useLiveCanvas({ onMutate: markDirty })
  const { onPointerMove, onPointerLeave } = useLiveCursors()

  const handleSpawnResult = React.useCallback(
    (result: GeneratedResult) => {
      setNodes((current) => {
        const working = [...current]
        const createdNodes: BoardNode[] = []

        for (const g of result.nodes) {
          const position = nextLanePosition(g.category, working)
          const node: BoardNode = {
            id: createNodeId(),
            type: g.category,
            position,
            data: { category: g.category, label: g.label, subLabel: g.subLabel },
          }
          working.push(node)
          createdNodes.push(node)
        }

        const createdGroups: BoardNode[] = []
        if (result.groups && result.groups.length > 0) {
          for (const g of result.groups) {
            const memberNodes = g.nodeIndices
              .filter((i) => i < createdNodes.length)
              .map((i) => createdNodes[i])
            if (memberNodes.length < 1) continue

            const bounds = computeGroupBounds(memberNodes)
            const groupNode: BoardNode = {
              id: createGroupId(),
              type: GROUP_NODE_TYPE,
              position: { x: bounds.x, y: bounds.y },
              width: bounds.width,
              height: bounds.height,
              zIndex: GROUP_Z_INDEX,
              data: {
                label: g.label,
                color: g.color ?? DEFAULT_GROUP_COLOR,
                childIds: memberNodes.map((m) => m.id),
              } satisfies GroupNodeData,
            }
            createdGroups.push(groupNode)
            working.push(groupNode)
          }
        }

        return [...current, ...createdGroups, ...createdNodes]
      })
    },
    [setNodes],
  )

  const ai = useAiSidebar({ projectId, onSpawn: handleSpawnResult })

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

  // Dirty tracking happens in useLiveCanvas, off Storage changes.
  const handleNodesChange: OnNodesChange<BoardNode> = (changes) => {
    onNodesChange(changes)

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

  const onConnect: OnConnect = (connection) => {
    addEdge({
      id: createEdgeId(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: ANNOTATED_EDGE_TYPE,
      data: { ...DEFAULT_EDGE_DATA },
    })
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

  // React Flow's selection is the source of truth, so keyboard selection
  // (Tab + Enter/Space) opens the panel too. The panel edits one element:
  // exactly one selected node, box or edge opens it; none or several close it.
  const handleSelectionChange: OnSelectionChangeFunc<BoardNode, BoardEdge> =
    React.useCallback(({ nodes: selectedNodes, edges: selectedEdges }) => {
      let next: SelectedElement | null = null
      if (selectedNodes.length + selectedEdges.length === 1) {
        next =
          selectedNodes.length === 1
            ? selectedNodeElement(selectedNodes[0])
            : { kind: "edge", id: selectedEdges[0].id }
      }
      setSelection((prev) =>
        prev?.kind === next?.kind && prev?.id === next?.id ? prev : next
      )

      const groupable = selectedNodes
        .filter((n) => n.type !== GROUP_NODE_TYPE)
        .map((n) => n.id)
      setGroupableIds((prev) => (sameIds(prev, groupable) ? prev : groupable))
    }, [])

  // Plain clicks select directly. A modifier click is a multi-select gesture,
  // so it is left to handleSelectionChange.
  const isMultiSelectClick = (event: React.MouseEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey
  const handleEdgeClick = (event: React.MouseEvent, edge: BoardEdge) => {
    if (isMultiSelectClick(event)) return
    setSelection({ kind: "edge", id: edge.id })
  }
  const handleNodeClick = (event: React.MouseEvent, node: BoardNode) => {
    if (isMultiSelectClick(event)) return
    setSelection(selectedNodeElement(node))
  }
  const handlePaneClick = () => setSelection(null)

  const updateEdgeData = (patch: Partial<AnnotatedEdgeData>) => {
    if (selection?.kind !== "edge") return
    setEdges((current) =>
      current.map((e) =>
        e.id === selection.id ? { ...e, data: { ...e.data, ...patch } } : e
      )
    )
  }

  const updateNodeData = (patch: Partial<SmartNodeData>) => {
    if (selection?.kind !== "node") return
    setNodes((current) =>
      current.map((n) =>
        n.id === selection.id ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  const updateGroupData = (patch: Partial<GroupNodeData>) => {
    if (selection?.kind !== "group") return
    setNodes((current) =>
      current.map((n) =>
        n.id === selection.id ? { ...n, data: { ...n.data, ...patch } } : n
      )
    )
  }

  // Members are independent nodes, so removing the box never touches them.
  // Edges attached to the box itself go with it, as React Flow's own delete does.
  const ungroup = () => {
    if (selection?.kind !== "group") return
    const id = selection.id
    setNodes((current) => current.filter((n) => n.id !== id))
    setEdges((current) =>
      current.filter((e) => e.source !== id && e.target !== id)
    )
    clearSelection()
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
  } else if (selection?.kind === "group") {
    const node = nodes.find((n) => n.id === selection.id)
    if (node) panelSelection = { kind: "group", node }
  }

  const canGroup = groupableIds.length >= 2

  const handleGroup = () => {
    const members = nodes.filter((n) => groupableIds.includes(n.id))
    if (members.length < 2) return
    const bounds = computeGroupBounds(members)
    const id = createGroupId()
    const groupData: GroupNodeData = {
      label: DEFAULT_GROUP_LABEL,
      color: DEFAULT_GROUP_COLOR,
      childIds: members.map((m) => m.id),
    }
    const groupNode: BoardNode = {
      id,
      type: GROUP_NODE_TYPE,
      position: { x: bounds.x, y: bounds.y },
      width: bounds.width,
      height: bounds.height,
      zIndex: GROUP_Z_INDEX,
      selected: true,
      data: groupData,
    }
    // Prepended so the box is first in DOM order, and the members it wraps are
    // deselected so React Flow's selection agrees with the panel.
    setNodes((current) => [
      groupNode,
      ...current.map((n) => (n.selected ? { ...n, selected: false } : n)),
    ])
    // A marquee selection leaves React Flow's multi-select overlay switched on.
    // It only clears it through its own deselect path, which setNodes bypasses,
    // so without this the overlay would sit on top of the box and block clicks
    // and connections on every member.
    store.setState({ nodesSelectionActive: false })
    setSelection({ kind: "group", id })
  }

  // Dragging a box moves its members by the same delta. The ref holds the
  // box's previous position so each tick applies only the increment.
  const groupDrag = React.useRef<{ id: string; x: number; y: number } | null>(
    null
  )

  const handleNodeDragStart: OnNodeDrag<BoardNode> = (_event, node) => {
    if (node.type !== GROUP_NODE_TYPE) return
    groupDrag.current = { id: node.id, x: node.position.x, y: node.position.y }
  }

  const handleNodeDrag: OnNodeDrag<BoardNode> = (_event, node) => {
    const last = groupDrag.current
    if (node.type !== GROUP_NODE_TYPE || last?.id !== node.id) return
    const dx = node.position.x - last.x
    const dy = node.position.y - last.y
    if (dx === 0 && dy === 0) return
    groupDrag.current = { id: node.id, x: node.position.x, y: node.position.y }

    const parsed = groupNodeDataSchema.safeParse(node.data)
    if (!parsed.success) return
    const childIds = new Set(parsed.data.childIds)
    // Selected members are already moved by React Flow's own multi-drag.
    setNodes((current) =>
      current.map((n) =>
        childIds.has(n.id) && !n.selected
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n
      )
    )
  }

  const handleNodeDragStop: OnNodeDrag<BoardNode> = (_event, node) => {
    if (groupDrag.current?.id !== node.id) return
    groupDrag.current = null
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={ai.toggle}
            aria-label="Toggle AI assistant"
            aria-pressed={ai.isOpen}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <HelpButton />
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
        <div className="flex h-full w-full">
          <div className="relative flex-1 overflow-hidden">
            <BoardCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeClick={handleEdgeClick}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              onSelectionChange={handleSelectionChange}
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
            >
              <Cursors />
            </BoardCanvas>
            <AddNodeToolbar
              onAdd={handleAddNode}
              onGroup={handleGroup}
              canGroup={canGroup}
            />
            {panelSelection && (
              <PropertyPanel
                selection={panelSelection}
                onEdgeDataChange={updateEdgeData}
                onNodeDataChange={updateNodeData}
                onGroupDataChange={updateGroupData}
                onUngroup={ungroup}
                onClose={clearSelection}
              />
            )}
          </div>
          <div
            className={cn(
              "h-full shrink-0 transition-[width] duration-200 ease-in-out",
              ai.isOpen ? "lg:w-90" : "lg:w-0 lg:overflow-hidden"
            )}
          >
            <AiSidebar
              isOpen={ai.isOpen}
              onClose={ai.close}
              input={ai.input}
              onInputChange={ai.setInput}
              messages={ai.messages}
              isSending={ai.isSending}
              onSubmit={ai.submit}
              onRetry={ai.retry}
            />
          </div>
        </div>
      )}
    </EditorShell>
  )
}
