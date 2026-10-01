import {
  LiveObject,
  type Json,
  type JsonObject,
  type LiveList,
  type LsonObject,
} from "@liveblocks/client"
import type { EdgeChange, NodeChange } from "@xyflow/react"

import type { BoardEdge, BoardNode } from "@/lib/canvas"

import type { StoredEdge, StoredNode } from "./types"

/**
 * Pure helpers bridging React Flow's element shape and Liveblocks Storage.
 * Nothing here touches React or the room: the hooks own that.
 */

/** Per-user node state React Flow needs but that must never be synced. */
export type LocalNodeState = Pick<
  BoardNode,
  "selected" | "measured" | "dragging" | "resizing"
>
export type LocalEdgeState = Pick<BoardEdge, "selected">

const LOCAL_NODE_KEYS = ["selected", "measured", "dragging", "resizing"]
const LOCAL_EDGE_KEYS = ["selected"]

function omitKeys(
  source: object,
  keys: readonly string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && !keys.includes(key)) result[key] = value
  }
  return result
}

/** Deep copy that drops `undefined`, which Storage JSON can't carry. */
function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function toStoredNode(node: BoardNode): StoredNode {
  const stored = omitKeys(node, LOCAL_NODE_KEYS)
  stored.data = toJson(node.data ?? {})
  return stored as unknown as StoredNode
}

export function toStoredEdge(edge: BoardEdge): StoredEdge {
  const stored = omitKeys(edge, LOCAL_EDGE_KEYS)
  if (edge.data !== undefined) stored.data = toJson(edge.data)
  return stored as unknown as StoredEdge
}

const NO_LOCAL_STATE = {}
const mergeCache = new WeakMap<object, WeakMap<object, unknown>>()

/**
 * Stored element + local overlay, cached per (stored, overlay) pair. Storage
 * snapshots are structurally shared, so an unchanged node keeps its identity
 * and React Flow doesn't re-render it.
 */
function merge<T>(stored: object, local: object | undefined): T {
  const key = local ?? NO_LOCAL_STATE
  let byLocal = mergeCache.get(stored)
  if (!byLocal) {
    byLocal = new WeakMap()
    mergeCache.set(stored, byLocal)
  }
  let merged = byLocal.get(key)
  if (!merged) {
    merged = { ...stored, ...local }
    byLocal.set(key, merged)
  }
  return merged as T
}

export function mergeNode(
  stored: object,
  local: LocalNodeState | undefined
): BoardNode {
  return merge<BoardNode>(stored, local)
}

export function mergeEdge(
  stored: object,
  local: LocalEdgeState | undefined
): BoardEdge {
  return merge<BoardEdge>(stored, local)
}

export function jsonEqual(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => jsonEqual(item, b[i]))
    )
  }
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  return aKeys.every((key) =>
    jsonEqual((a as JsonObject)[key], (b as JsonObject)[key])
  )
}

/** Brings one LiveObject in line with `next`, touching only what differs. */
export function syncObject<T extends LsonObject>(
  live: LiveObject<T>,
  next: T
): void {
  const keys = Object.keys(next) as (keyof T & string)[]
  for (const key of keys) {
    if (!jsonEqual(live.get(key) as Json, next[key] as Json)) {
      live.set(key, next[key])
    }
  }
  for (const key of live.keys() as Set<keyof T & string>) {
    if (!(key in next)) live.delete(key)
  }
}

/**
 * Applies a whole-array update to a LiveList: deletes what's gone, patches
 * what changed (only the differing fields) and inserts what's new at its
 * position, so a prepended group box stays ahead of its members.
 *
 * `current` is the array the update was derived from; an element that is
 * still the same reference in `next` is known to be unchanged and is skipped.
 */
export function reconcileList<
  Item extends { id: string },
  Stored extends LsonObject & { id: string },
>(
  list: LiveList<LiveObject<Stored>>,
  current: readonly Item[],
  next: readonly Item[],
  toStored: (item: Item) => Stored
): void {
  const nextIds = new Set(next.map((item) => item.id))
  for (let i = list.length - 1; i >= 0; i--) {
    const id = list.get(i)?.get("id")
    if (id === undefined || !nextIds.has(id as string)) list.delete(i)
  }

  const liveById = new Map<string, LiveObject<Stored>>()
  for (const live of list) liveById.set(live.get("id") as string, live)
  const currentById = new Map(current.map((item) => [item.id, item]))

  const additions: { item: Item; index: number }[] = []
  next.forEach((item, index) => {
    const live = liveById.get(item.id)
    if (!live) {
      additions.push({ item, index })
    } else if (currentById.get(item.id) !== item) {
      syncObject(live, toStored(item))
    }
  })
  // Ascending, so each insert lands after the survivors that precede it.
  for (const { item, index } of additions) {
    list.insert(
      new LiveObject(toStored(item)),
      Math.min(index, list.length)
    )
  }
}

const shallowSame = (a: object | undefined, b: object | undefined) => {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a) as (keyof typeof a)[]
  return (
    aKeys.length === Object.keys(b).length &&
    aKeys.every((key) => a[key] === (b as typeof a)[key])
  )
}

/** Overlay entries copied from the local fields of `items`, pruned to them. */
function overlayFrom<Item extends { id: string }, State extends object>(
  prev: Record<string, State>,
  items: readonly Item[],
  pick: (item: Item) => State | undefined
): Record<string, State> {
  const next: Record<string, State> = {}
  for (const item of items) {
    const state = pick(item)
    if (state === undefined) continue
    const before = prev[item.id]
    next[item.id] = shallowSame(before, state) ? before : state
  }
  const unchanged =
    Object.keys(next).length === Object.keys(prev).length &&
    Object.keys(next).every((id) => next[id] === prev[id])
  return unchanged ? prev : next
}

function pickDefined<T extends object>(
  source: T,
  keys: readonly (keyof T)[]
): Partial<T> | undefined {
  const picked: Partial<T> = {}
  let any = false
  for (const key of keys) {
    if (source[key] !== undefined) {
      picked[key] = source[key]
      any = true
    }
  }
  return any ? picked : undefined
}

/** After a whole-array update, mirror its local fields (e.g. `selected`). */
export function localNodesFrom(
  prev: Record<string, LocalNodeState>,
  nodes: readonly BoardNode[]
): Record<string, LocalNodeState> {
  return overlayFrom(
    prev,
    nodes,
    (n) =>
      pickDefined(n, ["selected", "measured", "dragging", "resizing"]) as
        | LocalNodeState
        | undefined
  )
}

export function localEdgesFrom(
  prev: Record<string, LocalEdgeState>,
  edges: readonly BoardEdge[]
): Record<string, LocalEdgeState> {
  return overlayFrom(
    prev,
    edges,
    (e) => pickDefined(e, ["selected"]) as LocalEdgeState | undefined
  )
}

function without<T>(record: Record<string, T>, id: string): Record<string, T> {
  if (!(id in record)) return record
  const rest = { ...record }
  delete rest[id]
  return rest
}

/** Folds React Flow's node changes into the local overlay. */
export function applyLocalNodeChanges(
  prev: Record<string, LocalNodeState>,
  changes: readonly NodeChange<BoardNode>[]
): Record<string, LocalNodeState> {
  let next = prev
  const patch = (id: string, state: Partial<LocalNodeState>) => {
    const before = next[id]
    if (before && shallowSame(before, { ...before, ...state })) return
    next = { ...next, [id]: { ...before, ...state } }
  }
  for (const change of changes) {
    switch (change.type) {
      case "select":
        patch(change.id, { selected: change.selected })
        break
      case "dimensions":
        if (change.dimensions) patch(change.id, { measured: change.dimensions })
        if (typeof change.resizing === "boolean") {
          patch(change.id, { resizing: change.resizing })
        }
        break
      case "position":
        if (typeof change.dragging === "boolean") {
          patch(change.id, { dragging: change.dragging })
        }
        break
      case "remove":
        next = without(next, change.id)
        break
    }
  }
  return next
}

export function applyLocalEdgeChanges(
  prev: Record<string, LocalEdgeState>,
  changes: readonly EdgeChange<BoardEdge>[]
): Record<string, LocalEdgeState> {
  let next = prev
  for (const change of changes) {
    if (change.type === "select") {
      if (next[change.id]?.selected !== change.selected) {
        next = { ...next, [change.id]: { selected: change.selected } }
      }
    } else if (change.type === "remove") {
      next = without(next, change.id)
    }
  }
  return next
}
