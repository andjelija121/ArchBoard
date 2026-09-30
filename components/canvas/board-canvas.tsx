"use client"

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "./react-flow-overrides.css"

import { nodeTypes } from "@/components/canvas/nodes/node-types"
import type { BoardEdge, BoardNode } from "@/lib/canvas"

interface BoardCanvasProps {
  nodes: BoardNode[]
  edges: BoardEdge[]
  onNodesChange: OnNodesChange<BoardNode>
  onEdgesChange: OnEdgesChange<BoardEdge>
  onConnect: OnConnect
}

/** The React Flow viewport. Presentational only: state and saving live in BoardEditor. */
export function BoardCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: BoardCanvasProps) {
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
