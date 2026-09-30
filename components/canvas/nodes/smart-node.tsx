"use client"

import * as React from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "cn"

import { smartNodeDataSchema } from "@/lib/canvas"
import {
  CATEGORY_ICON,
  CATEGORY_STYLE,
} from "@/components/canvas/nodes/node-style"

function SmartNodeBase({ data, selected }: NodeProps) {
  const parsed = smartNodeDataSchema.safeParse(data)
  if (!parsed.success) return null

  const { category, label, subLabel } = parsed.data
  const Icon = CATEGORY_ICON[category]
  const style = CATEGORY_STYLE[category]

  return (
    <div
      className={cn(
        "flex min-h-14 w-44 items-center gap-2 rounded-md border p-3",
        style.border,
        style.bg,
        selected && "border-2 border-primary"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", style.icon)} strokeWidth={1.5} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {label}
        </span>
        {subLabel && (
          <span className="truncate font-mono text-xs text-muted-foreground">
            {subLabel}
          </span>
        )}
      </div>
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
  )
}

export const SmartNode = React.memo(SmartNodeBase)
