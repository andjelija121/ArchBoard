"use client"

import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  CATEGORY_LABEL,
  NODE_CATEGORIES,
  type NodeCategory,
} from "@/lib/canvas"
import {
  CATEGORY_ICON,
  CATEGORY_STYLE,
} from "@/components/canvas/nodes/node-style"

interface AddNodeToolbarProps {
  onAdd: (category: NodeCategory) => void
}

/** Floating palette; buttons follow swimlane order, left to right. */
export function AddNodeToolbar({ onAdd }: AddNodeToolbarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-md border border-border bg-card p-1 shadow-sm">
      {NODE_CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICON[category]
        return (
          <Button
            key={category}
            variant="ghost"
            size="sm"
            aria-label={`Add ${CATEGORY_LABEL[category]}`}
            onClick={() => onAdd(category)}
          >
            <Icon
              className={cn("h-4 w-4", CATEGORY_STYLE[category].icon)}
              strokeWidth={1.5}
            />
            <span className="text-xs font-medium">
              {CATEGORY_LABEL[category]}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
