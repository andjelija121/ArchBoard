"use client"

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeFunc,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "./react-flow-overrides.css"

import { EdgeClickContext } from "@/components/canvas/edges/edge-click-context"
import { edgeTypes } from "@/components/canvas/edges/edge-types"
import { nodeTypes } from "@/components/canvas/nodes/node-types"
import {
  ANNOTATED_EDGE_TYPE,
  DEFAULT_EDGE_DATA,
  type BoardEdge,
  type BoardNode,
} from "@/lib/canvas"

interface BoardCanvasProps {
  nodes: BoardNode[]
  edges: BoardEdge[]
  onNodesChange: OnNodesChange<BoardNode>
  onEdgesChange: OnEdgesChange<BoardEdge>
  onConnect: OnConnect
  onEdgeClick: (event: React.MouseEvent, edge: BoardEdge) => void
  onNodeClick: (event: React.MouseEvent, node: BoardNode) => void
  onPaneClick: () => void
  onSelectionChange: OnSelectionChangeFunc<BoardNode, BoardEdge>
  onNodeDragStart: OnNodeDrag<BoardNode>
  onNodeDrag: OnNodeDrag<BoardNode>
  onNodeDragStop: OnNodeDrag<BoardNode>
  onPointerMove: React.PointerEventHandler<HTMLDivElement>
  onPointerLeave: React.PointerEventHandler<HTMLDivElement>
  /** View-only guests: no dragging, connecting, selecting or focusing. */
  readOnly?: boolean
  /** Rendered inside the viewport, e.g. the live cursor overlay. */
  children?: React.ReactNode
}

// Edges drawn by dragging between handles render as annotated edges.
const defaultEdgeOptions = {
  type: ANNOTATED_EDGE_TYPE,
  data: DEFAULT_EDGE_DATA,
}

/** The React Flow viewport. Presentational only: state and saving live in BoardEditor. */
export function BoardCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdgeClick,
  onNodeClick,
  onPaneClick,
  onSelectionChange,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onPointerMove,
  onPointerLeave,
  readOnly = false,
  children,
}: BoardCanvasProps) {
  return (
    <div
      className="h-full w-full"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <EdgeClickContext.Provider value={onEdgeClick}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          // Selecting a node would otherwise lift it 1000 z-levels, so a
          // selected bounding box would cover (and swallow clicks for) its members.
          elevateNodesOnSelect={false}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          edgesFocusable={!readOnly}
          nodesFocusable={!readOnly}
          deleteKeyCode={readOnly ? null : undefined}
          colorMode="dark"
          fitView
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          {children}
        </ReactFlow>
      </EdgeClickContext.Provider>
    </div>
  )
}
