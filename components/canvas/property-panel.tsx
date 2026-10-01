"use client"

import * as React from "react"
import { Boxes, X } from "lucide-react"
import { cn } from "cn"

import { GROUP_STYLE } from "@/components/canvas/groups/group-style"
import {
  CATEGORY_ICON,
  CATEGORY_STYLE,
} from "@/components/canvas/nodes/node-style"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CATEGORY_LABEL,
  DEFAULT_EDGE_DATA,
  EDGE_PROTOCOLS,
  GROUP_COLORS,
  PROTOCOL_LABEL,
  annotatedEdgeDataSchema,
  groupNodeDataSchema,
  smartNodeDataSchema,
  type AnnotatedEdgeData,
  type BoardEdge,
  type BoardNode,
  type GroupNodeData,
  type SmartNodeData,
} from "@/lib/canvas"

export type PropertyPanelSelection =
  | { kind: "edge"; edge: BoardEdge }
  | { kind: "node"; node: BoardNode }
  | { kind: "group"; node: BoardNode }

interface PropertyPanelProps {
  selection: PropertyPanelSelection
  onEdgeDataChange: (patch: Partial<AnnotatedEdgeData>) => void
  onNodeDataChange: (patch: Partial<SmartNodeData>) => void
  onGroupDataChange: (patch: Partial<GroupNodeData>) => void
  onUngroup: () => void
  onClose: () => void
}

const LABEL_MAX = 80
const SUB_LABEL_MAX = 80
const API_ROUTE_MAX = 120
const LOAD_ESTIMATE_MAX = 80

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

/** Segmented control built from Buttons: the active option uses the accent. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === value ? "default" : "outline"}
          aria-pressed={option.value === value}
          className="flex-1"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

const PROTOCOL_OPTIONS = EDGE_PROTOCOLS.map((value) => ({
  value,
  label: PROTOCOL_LABEL[value],
}))

const BEHAVIOR_OPTIONS = [
  { value: "sync", label: "Sync" },
  { value: "async", label: "Async" },
] as const

function EdgeFields({
  edge,
  onChange,
}: {
  edge: BoardEdge
  onChange: (patch: Partial<AnnotatedEdgeData>) => void
}) {
  const routeId = React.useId()
  const loadId = React.useId()
  const parsed = annotatedEdgeDataSchema.safeParse(edge.data)
  const data = parsed.success ? parsed.data : DEFAULT_EDGE_DATA

  return (
    <>
      <Field label="Protocol">
        <Segmented
          label="Protocol"
          options={PROTOCOL_OPTIONS}
          value={data.protocol}
          onChange={(protocol) => onChange({ protocol })}
        />
      </Field>
      <Field label="Behavior">
        <Segmented
          label="Behavior"
          options={BEHAVIOR_OPTIONS}
          value={data.async ? "async" : "sync"}
          onChange={(behavior) => onChange({ async: behavior === "async" })}
        />
      </Field>
      <Field label="API route" htmlFor={routeId}>
        <Input
          id={routeId}
          className="font-mono"
          placeholder="GET /v1/..."
          maxLength={API_ROUTE_MAX}
          value={data.apiRoute ?? ""}
          onChange={(event) =>
            onChange({ apiRoute: event.target.value || undefined })
          }
        />
      </Field>
      <Field label="Load estimate" htmlFor={loadId}>
        <Input
          id={loadId}
          placeholder="e.g. 2k rps"
          maxLength={LOAD_ESTIMATE_MAX}
          value={data.loadEstimate ?? ""}
          onChange={(event) =>
            onChange({ loadEstimate: event.target.value || undefined })
          }
        />
      </Field>
    </>
  )
}

/**
 * Label input for elements whose stored label must stay non-empty. The field
 * may be blank while typing without writing that blank value; blur restores
 * the last stored label.
 */
function LabelField({
  label,
  onChange,
}: {
  label: string
  onChange: (label: string) => void
}) {
  const labelId = React.useId()
  const [draft, setDraft] = React.useState(label)

  return (
    <Field label="Label" htmlFor={labelId}>
      <Input
        id={labelId}
        maxLength={LABEL_MAX}
        value={draft}
        onChange={(event) => {
          const value = event.target.value
          setDraft(value)
          if (value.trim() !== "") onChange(value)
        }}
        onBlur={() => {
          if (draft.trim() === "") setDraft(label)
        }}
      />
    </Field>
  )
}

function NodeFields({
  data,
  onChange,
}: {
  data: SmartNodeData
  onChange: (patch: Partial<SmartNodeData>) => void
}) {
  const subLabelId = React.useId()

  return (
    <>
      <LabelField label={data.label} onChange={(label) => onChange({ label })} />
      <Field label="Sub-label" htmlFor={subLabelId}>
        <Input
          id={subLabelId}
          className="font-mono"
          placeholder="e.g. postgres"
          maxLength={SUB_LABEL_MAX}
          value={data.subLabel ?? ""}
          onChange={(event) =>
            onChange({ subLabel: event.target.value || undefined })
          }
        />
      </Field>
    </>
  )
}

function GroupFields({
  data,
  onChange,
  onUngroup,
}: {
  data: GroupNodeData
  onChange: (patch: Partial<GroupNodeData>) => void
  onUngroup: () => void
}) {
  return (
    <>
      <LabelField label={data.label} onChange={(label) => onChange({ label })} />
      <Field label="Color">
        <div role="group" aria-label="Color" className="flex gap-2">
          {GROUP_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={color === data.color}
              className={cn(
                "h-6 w-6 cursor-pointer rounded-sm outline-offset-2",
                GROUP_STYLE[color].swatch,
                color === data.color && "outline-2 outline-primary"
              )}
              onClick={() => onChange({ color })}
            />
          ))}
        </div>
      </Field>
      <div className="flex flex-col gap-1.5">
        <Button type="button" variant="outline" onClick={onUngroup}>
          Ungroup
        </Button>
        <p className="text-xs text-muted-foreground">
          Dissolve the box (keeps the nodes)
        </p>
      </div>
    </>
  )
}

function GroupBody({
  node,
  onChange,
  onUngroup,
}: {
  node: BoardNode
  onChange: (patch: Partial<GroupNodeData>) => void
  onUngroup: () => void
}) {
  const parsed = groupNodeDataSchema.safeParse(node.data)
  if (!parsed.success) {
    return (
      <p className="text-sm text-muted-foreground">
        This box&apos;s data is invalid, so it can&apos;t be edited.
      </p>
    )
  }
  // Keyed by id so the label draft never carries over between boxes.
  return (
    <GroupFields
      key={node.id}
      data={parsed.data}
      onChange={onChange}
      onUngroup={onUngroup}
    />
  )
}

function PanelTitle({ selection }: { selection: PropertyPanelSelection }) {
  if (selection.kind === "edge") {
    return <span>Edge</span>
  }
  if (selection.kind === "group") {
    const parsed = groupNodeDataSchema.safeParse(selection.node.data)
    const color = parsed.success ? parsed.data.color : "slate"
    return (
      <span className="flex items-center gap-2">
        <Boxes
          className={cn("h-4 w-4", GROUP_STYLE[color].icon)}
          strokeWidth={1.5}
        />
        Group
      </span>
    )
  }
  const parsed = smartNodeDataSchema.safeParse(selection.node.data)
  if (!parsed.success) return <span>Node</span>

  const { category } = parsed.data
  const Icon = CATEGORY_ICON[category]
  return (
    <span className="flex items-center gap-2">
      <Icon
        className={cn("h-4 w-4", CATEGORY_STYLE[category].icon)}
        strokeWidth={1.5}
      />
      {CATEGORY_LABEL[category]}
    </span>
  )
}

function NodeBody({
  node,
  onChange,
}: {
  node: BoardNode
  onChange: (patch: Partial<SmartNodeData>) => void
}) {
  const parsed = smartNodeDataSchema.safeParse(node.data)
  if (!parsed.success) {
    return (
      <p className="text-sm text-muted-foreground">
        This node&apos;s data is invalid, so it can&apos;t be edited.
      </p>
    )
  }
  // Keyed by id so the label draft never carries over between nodes.
  return <NodeFields key={node.id} data={parsed.data} onChange={onChange} />
}

/**
 * Right-anchored panel shared by edges and nodes. Presentational only: the
 * live element comes in as a prop and edits go out as patches.
 */
export function PropertyPanel({
  selection,
  onEdgeDataChange,
  onNodeDataChange,
  onGroupDataChange,
  onUngroup,
  onClose,
}: PropertyPanelProps) {
  return (
    <aside
      aria-label="Properties"
      className="absolute inset-y-0 right-0 z-40 flex w-80 max-w-full flex-col border-l border-border bg-card animate-in duration-200 slide-in-from-right"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-base font-semibold text-foreground">
          <PanelTitle selection={selection} />
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close properties"
          onClick={onClose}
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          {selection.kind === "edge" && (
            <EdgeFields
              key={selection.edge.id}
              edge={selection.edge}
              onChange={onEdgeDataChange}
            />
          )}
          {selection.kind === "node" && (
            <NodeBody node={selection.node} onChange={onNodeDataChange} />
          )}
          {selection.kind === "group" && (
            <GroupBody
              node={selection.node}
              onChange={onGroupDataChange}
              onUngroup={onUngroup}
            />
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
