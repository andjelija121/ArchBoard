"use client"

import * as React from "react"
import { LiveObject } from "@liveblocks/client"
import type { EdgeChange, NodeChange } from "@xyflow/react"

import { useMutation, useStorage } from "@/liveblocks.config"
import type { BoardEdge, BoardNode } from "@/lib/canvas"

import {
  applyLocalEdgeChanges,
  applyLocalNodeChanges,
  localEdgesFrom,
  localNodesFrom,
  mergeEdge,
  mergeNode,
  reconcileList,
  syncObject,
  toStoredEdge,
  toStoredNode,
  type LocalEdgeState,
  type LocalNodeState,
} from "./canvas-sync"

type Updater<T> = T[] | ((current: T[]) => T[])

interface UseLiveCanvasOptions {
  /** Called whenever Storage changes (a local edit or another client's). */
  onMutate?: () => void
}

const EMPTY_OVERLAY = {}

/**
 * Per-user overlay (selection, measured size…) kept beside Storage. The ref
 * mirrors the state so handlers always read the latest value synchronously.
 */
function useLocalOverlay<State>() {
  const ref = React.useRef<Record<string, State>>(EMPTY_OVERLAY)
  const [state, setState] = React.useState<Record<string, State>>(EMPTY_OVERLAY)
  const update = React.useCallback(
    (fn: (prev: Record<string, State>) => Record<string, State>) => {
      const next = fn(ref.current)
      if (next === ref.current) return
      ref.current = next
      setState(next)
    },
    []
  )
  return [state, update, ref] as const
}

/**
 * Liveblocks-backed replacement for React Flow's `useNodesState` /
 * `useEdgesState`. Storage is the source of truth for the elements
 * themselves; selection, measured sizes and drag flags stay local.
 */
export function useLiveCanvas({ onMutate }: UseLiveCanvasOptions = {}) {
  const storedNodes = useStorage((root) => root.nodes)
  const storedEdges = useStorage((root) => root.edges)
  const [localNodes, updateLocalNodes, localNodesRef] =
    useLocalOverlay<LocalNodeState>()
  const [localEdges, updateLocalEdges, localEdgesRef] =
    useLocalOverlay<LocalEdgeState>()

  const nodes = React.useMemo(
    () => storedNodes.map((stored) => mergeNode(stored, localNodes[stored.id])),
    [storedNodes, localNodes]
  )
  const edges = React.useMemo(
    () => storedEdges.map((stored) => mergeEdge(stored, localEdges[stored.id])),
    [storedEdges, localEdges]
  )

  // Storage only changes on real edits (selection and measurement are local),
  // so a changed reference means the board differs from what was last saved.
  const lastSeen = React.useRef({ nodes: storedNodes, edges: storedEdges })
  const onMutateRef = React.useRef(onMutate)
  React.useEffect(() => {
    onMutateRef.current = onMutate
  })
  React.useEffect(() => {
    if (
      lastSeen.current.nodes === storedNodes &&
      lastSeen.current.edges === storedEdges
    ) {
      return
    }
    lastSeen.current = { nodes: storedNodes, edges: storedEdges }
    onMutateRef.current?.()
  }, [storedNodes, storedEdges])

  const applyNodeChanges = useMutation(
    ({ storage }, changes: NodeChange<BoardNode>[]) => {
      const list = storage.get("nodes")
      const find = (id: string) =>
        list.find((live) => live.get("id") === id)

      for (const change of changes) {
        switch (change.type) {
          case "position": {
            const live = find(change.id)
            if (!live || !change.position) break
            const current = live.get("position")
            if (
              current.x !== change.position.x ||
              current.y !== change.position.y
            ) {
              live.set("position", change.position)
            }
            break
          }
          case "dimensions": {
            // Only a user resize persists a size; plain measurement is local.
            const live = find(change.id)
            if (!live || !change.setAttributes || !change.dimensions) break
            const { width, height } = change.dimensions
            if (change.setAttributes !== "height") live.set("width", width)
            if (change.setAttributes !== "width") live.set("height", height)
            break
          }
          case "remove": {
            const index = list.findIndex((live) => live.get("id") === change.id)
            if (index !== -1) list.delete(index)
            break
          }
          case "add": {
            if (find(change.item.id)) break
            list.insert(
              new LiveObject(toStoredNode(change.item)),
              Math.min(change.index ?? list.length, list.length)
            )
            break
          }
          case "replace": {
            const live = find(change.id)
            if (live) syncObject(live, toStoredNode(change.item))
            break
          }
        }
      }
    },
    []
  )

  const applyEdgeChanges = useMutation(
    ({ storage }, changes: EdgeChange<BoardEdge>[]) => {
      const list = storage.get("edges")
      const find = (id: string) =>
        list.find((live) => live.get("id") === id)

      for (const change of changes) {
        switch (change.type) {
          case "remove": {
            const index = list.findIndex((live) => live.get("id") === change.id)
            if (index !== -1) list.delete(index)
            break
          }
          case "add": {
            if (find(change.item.id)) break
            list.insert(
              new LiveObject(toStoredEdge(change.item)),
              Math.min(change.index ?? list.length, list.length)
            )
            break
          }
          case "replace": {
            const live = find(change.id)
            if (live) syncObject(live, toStoredEdge(change.item))
            break
          }
        }
      }
    },
    []
  )

  const onNodesChange = React.useCallback(
    (changes: NodeChange<BoardNode>[]) => {
      updateLocalNodes((prev) => applyLocalNodeChanges(prev, changes))
      applyNodeChanges(changes)
    },
    [applyNodeChanges, updateLocalNodes]
  )

  const onEdgesChange = React.useCallback(
    (changes: EdgeChange<BoardEdge>[]) => {
      updateLocalEdges((prev) => applyLocalEdgeChanges(prev, changes))
      applyEdgeChanges(changes)
    },
    [applyEdgeChanges, updateLocalEdges]
  )

  // Imperative updates (group creation, AI spawn…) are derived from Storage as
  // it is *now*, then written back as a minimal diff.
  const setNodes = useMutation(({ storage }, updater: Updater<BoardNode>) => {
    const list = storage.get("nodes")
    const current = list
      .toJSON()
      .map((stored) => mergeNode(stored, localNodesRef.current[stored.id]))
    const next = typeof updater === "function" ? updater(current) : updater
    reconcileList(list, current, next, toStoredNode)
    updateLocalNodes((prev) => localNodesFrom(prev, next))
  }, [])

  const setEdges = useMutation(({ storage }, updater: Updater<BoardEdge>) => {
    const list = storage.get("edges")
    const current = list
      .toJSON()
      .map((stored) => mergeEdge(stored, localEdgesRef.current[stored.id]))
    const next = typeof updater === "function" ? updater(current) : updater
    reconcileList(list, current, next, toStoredEdge)
    updateLocalEdges((prev) => localEdgesFrom(prev, next))
  }, [])

  /** Appends an edge unless the same connection already exists. */
  const addEdge = useMutation(({ storage }, edge: BoardEdge) => {
    const list = storage.get("edges")
    const exists = list.some((live) => {
      const stored = live.toJSON()
      return (
        stored.id === edge.id ||
        (stored.source === edge.source &&
          stored.target === edge.target &&
          (stored.sourceHandle ?? null) === (edge.sourceHandle ?? null) &&
          (stored.targetHandle ?? null) === (edge.targetHandle ?? null))
      )
    })
    if (!exists) list.push(new LiveObject(toStoredEdge(edge)))
  }, [])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges,
    addEdge,
  }
}
