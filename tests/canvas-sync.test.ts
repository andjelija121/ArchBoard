import { LiveList, LiveObject } from "@liveblocks/client"
import { describe, expect, it, vi } from "vitest"
import type { BoardNode } from "../lib/canvas"
import {
  applyLocalNodeChanges, applyLocalEdgeChanges, jsonEqual,
  localNodesFrom, mergeNode, reconcileList, syncObject,
  toStoredEdge, toStoredNode,
} from "../lib/liveblocks/canvas-sync"

const node = (id = "n1"): BoardNode => ({
  id, position: { x: 10, y: 20 }, data: { label: "API" },
})

describe("shared storage", () => {
  it("keeps selection and dragging private while preserving board content", () => {
    const original = { ...node(), selected: true, dragging: true,
      resizing: false, measured: { width: 176, height: 56 } }
    expect(toStoredNode(original)).toEqual(node())
    expect(original.selected).toBe(true)
  })

  it("copies nested data and removes values JSON cannot store", () => {
    const original = { ...node(), data: { nested: { label: "API", optional: undefined } } }
    const stored = toStoredNode(original)
    expect(stored.data).toEqual({ nested: { label: "API" } })
    original.data.nested.label = "Changed"
    expect(stored.data).toEqual({ nested: { label: "API" } })
  })

  it("keeps edge endpoints but does not share edge selection", () => {
    expect(toStoredEdge({ id: "e1", source: "n1", target: "n2", selected: true }))
      .toEqual({ id: "e1", source: "n1", target: "n2" })
  })

  it("compares objects independently of key order but respects array order", () => {
    expect(jsonEqual({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 })).toBe(true)
    expect(jsonEqual([2, 3], [3, 2])).toBe(false)
    expect(jsonEqual(null, {})).toBe(false)
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it("patches changed fields, deletes removed fields, and avoids redundant writes", () => {
    const live = new LiveObject<{ label: string; obsolete?: boolean }>({ label: "API", obsolete: true })
    const set = vi.spyOn(live, "set")
    syncObject(live, { label: "API" })
    expect(set).not.toHaveBeenCalled()
    expect(live.get("obsolete")).toBeUndefined()
    syncObject(live, { label: "Database" })
    expect(live.get("label")).toBe("Database")
    expect(set).toHaveBeenCalledTimes(1)
  })

  it("deletes missing nodes, updates survivors, and inserts a group before its member", () => {
    const current = [{ id: "removed", label: "Old" }, { id: "member", label: "API" }]
    const survivor = new LiveObject(current[1])
    const list = new LiveList([new LiveObject(current[0]), survivor])
    const next = [{ id: "group", label: "Backend" }, { id: "member", label: "Updated" }]
    reconcileList(list, current, next, (item) => ({ ...item }))
    expect(Array.from(list, (item) => ({ id: item.get("id"), label: item.get("label") }))).toEqual(next)
    expect(list.get(1)).toBe(survivor)
  })
})

describe("local user state", () => {
  it("merges local selection without modifying storage and preserves stable identity", () => {
    const stored = node()
    const local = { selected: true }
    const merged = mergeNode(stored, local)
    expect(merged.selected).toBe(true)
    expect(stored).not.toHaveProperty("selected")
    expect(mergeNode(stored, local)).toBe(merged)
    expect(mergeNode(stored, { selected: false }).selected).toBe(false)
  })

  it("prunes removed nodes and reuses an unchanged overlay", () => {
    const previous = { n1: { selected: true }, removed: { selected: false } }
    const result = localNodesFrom(previous, [{ ...node(), selected: true }])
    expect(result).toEqual({ n1: { selected: true } })
    expect(result.n1).toBe(previous.n1)
    expect(localNodesFrom(result, [{ ...node(), selected: true }])).toBe(result)
  })

  it("applies selection, dimensions and dragging without storing shared positions", () => {
    const result = applyLocalNodeChanges({}, [
      { type: "select", id: "n1", selected: true },
      { type: "dimensions", id: "n1", dimensions: { width: 200, height: 80 }, resizing: true },
      { type: "position", id: "n1", position: { x: 99, y: 99 }, dragging: true },
    ])
    expect(result.n1).toEqual({ selected: true, measured: { width: 200, height: 80 }, resizing: true, dragging: true })
    expect(applyLocalNodeChanges(result, [{ type: "remove", id: "n1" }])).toEqual({})
  })

  it("reuses unchanged edge state and cleans it up when an edge is removed", () => {
    const previous = { e1: { selected: true } }
    expect(applyLocalEdgeChanges(previous, [{ type: "select", id: "e1", selected: true }])).toBe(previous)
    expect(applyLocalEdgeChanges(previous, [{ type: "remove", id: "e1" }])).toEqual({})
  })
})

