"use client"

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type OnConnect,
  type OnEdgesChange,
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
}: BoardCanvasProps) {
  return (
    <div className="h-full w-full">
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
          colorMode="dark"
          fitView
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
        </ReactFlow>
      </EdgeClickContext.Provider>
    </div>
  )
}
