import { SmartNode } from "@/components/canvas/nodes/smart-node"

// Module-level so React Flow sees a stable reference across renders.
export const nodeTypes = {
  client: SmartNode,
  lb: SmartNode,
  compute: SmartNode,
  cache: SmartNode,
  queue: SmartNode,
  database: SmartNode,
}
