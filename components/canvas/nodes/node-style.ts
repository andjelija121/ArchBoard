import {
  Database,
  ListOrdered,
  Monitor,
  Server,
  Split,
  Zap,
  type LucideIcon,
} from "lucide-react"

import type { NodeCategory } from "@/lib/canvas"

export const CATEGORY_ICON: Record<NodeCategory, LucideIcon> = {
  client: Monitor,
  lb: Split,
  compute: Server,
  cache: Zap,
  queue: ListOrdered,
  database: Database,
}

// Spelled out per category so Tailwind's scanner emits every class.
export const CATEGORY_STYLE: Record<
  NodeCategory,
  { border: string; bg: string; icon: string }
> = {
  client: {
    border: "border-node-client",
    bg: "bg-node-client-bg",
    icon: "text-node-client",
  },
  lb: {
    border: "border-node-lb",
    bg: "bg-node-lb-bg",
    icon: "text-node-lb",
  },
  compute: {
    border: "border-node-compute",
    bg: "bg-node-compute-bg",
    icon: "text-node-compute",
  },
  cache: {
    border: "border-node-cache",
    bg: "bg-node-cache-bg",
    icon: "text-node-cache",
  },
  queue: {
    border: "border-node-queue",
    bg: "bg-node-queue-bg",
    icon: "text-node-queue",
  },
  database: {
    border: "border-node-database",
    bg: "bg-node-database-bg",
    icon: "text-node-database",
  },
}
