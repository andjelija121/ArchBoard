import { AnnotatedEdge } from "@/components/canvas/edges/annotated-edge"
import { ANNOTATED_EDGE_TYPE } from "@/lib/canvas"

// Module-level so React Flow sees a stable reference across renders.
export const edgeTypes = {
  [ANNOTATED_EDGE_TYPE]: AnnotatedEdge,
}
