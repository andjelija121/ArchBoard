"use client"

import * as React from "react"
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react"
import { Boxes } from "lucide-react"
import { cn } from "cn"

import { GROUP_STYLE } from "@/components/canvas/groups/group-style"
import {
  GROUP_MIN_HEIGHT,
  GROUP_MIN_WIDTH,
  groupNodeDataSchema,
} from "@/lib/canvas"

function GroupNodeBase({ data, selected }: NodeProps) {
  const parsed = groupNodeDataSchema.safeParse(data)
  if (!parsed.success) return null

  const { label, color } = parsed.data
  const style = GROUP_STYLE[color]

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={GROUP_MIN_WIDTH}
        minHeight={GROUP_MIN_HEIGHT}
        lineClassName="!border-primary"
        handleClassName="!border-0 !bg-primary"
      />
      <div
        className={cn(
          "relative h-full w-full rounded-md border-2 border-dashed",
          style.bg,
          selected ? "border-primary" : style.border
        )}
      >
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-0.5">
          <Boxes
            className={cn("h-4 w-4 shrink-0", style.icon)}
            strokeWidth={1.5}
          />
          <span className="max-w-40 truncate text-xs font-medium text-foreground">
            {label}
          </span>
        </span>
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !border-0 !bg-border"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !border-0 !bg-border"
        />
      </div>
    </>
  )
}

export const GroupNode = React.memo(GroupNodeBase)
