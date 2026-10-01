"use client"

import * as React from "react"

import { saveCanvas } from "@/app/editor/[projectId]/actions"
import type { CanvasSnapshot } from "@/lib/canvas"

/** The save-status machine the navbar indicator renders. */
export type SaveStatusValue = "clean" | "dirty" | "saving" | "saved" | "error"

const DEFAULT_DELAY_MS = 2000

interface UseAutosaveOptions {
  projectId: string
  /** Reads the current nodes/edges to flush. */
  getSnapshot: () => CanvasSnapshot
  /** `false` for guests: no debounce is scheduled and nothing is flushed. */
  enabled: boolean
  /** Debounce window after editing stops. Defaults to 2000ms. */
  delayMs?: number
}

export interface UseAutosave {
  status: SaveStatusValue
  error: string | null
  /** Marks the board dirty and (re)starts the debounce when enabled. */
  markDirty: () => void
  /** Manual Save: cancels any pending debounce and flushes immediately. */
  saveNow: () => void
}

/**
 * Owns the whole save lifecycle for the board: the debounce timer, the
 * in-flight guard, and the status machine, so they stay consistent in one
 * place. `markDirty` is wired to `useLiveCanvas({ onMutate })`, so autosave
 * fires on both local and remote Storage edits; `saveNow` backs the manual
 * Save button.
 */
export function useAutosave({
  projectId,
  getSnapshot,
  enabled,
  delayMs = DEFAULT_DELAY_MS,
}: UseAutosaveOptions): UseAutosave {
  const [status, setStatus] = React.useState<SaveStatusValue>("clean")
  const [error, setError] = React.useState<string | null>(null)

  // Bumped on every edit so an in-flight flush can tell whether more edits
  // landed while it was saving (and the board must stay dirty).
  const editVersion = React.useRef(0)
  const savingRef = React.useRef(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs keep the stable callbacks reading the latest props/state. Synced in
  // an effect because writing a ref during render is disallowed.
  const getSnapshotRef = React.useRef(getSnapshot)
  const projectIdRef = React.useRef(projectId)
  const statusRef = React.useRef(status)
  React.useEffect(() => {
    getSnapshotRef.current = getSnapshot
    projectIdRef.current = projectId
    statusRef.current = status
  })

  const clearTimer = React.useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const flush = React.useCallback(async () => {
    clearTimer()
    // A flush already in flight is not interrupted; edits that land during it
    // keep the board dirty via the editVersion guard below.
    if (savingRef.current) return
    savingRef.current = true
    const savedVersion = editVersion.current
    setStatus("saving")
    setError(null)
    try {
      const result = await saveCanvas({
        projectId: projectIdRef.current,
        snapshot: getSnapshotRef.current(),
      })
      if (result.ok) {
        // Edits made mid-flight aren't in the saved snapshot; stay dirty.
        setStatus(editVersion.current === savedVersion ? "saved" : "dirty")
      } else {
        setStatus("error")
        setError(result.error)
      }
    } catch {
      setStatus("error")
      setError("Couldn't save. Please try again.")
    } finally {
      savingRef.current = false
    }
  }, [clearTimer])

  const markDirty = React.useCallback(() => {
    editVersion.current += 1
    setStatus("dirty")
    if (!enabled) return
    clearTimer()
    timer.current = setTimeout(() => {
      timer.current = null
      void flush()
    }, delayMs)
  }, [enabled, delayMs, clearTimer, flush])

  const saveNow = React.useCallback(() => {
    // No-op with nothing pending — same disabled condition as the Save button.
    if (statusRef.current === "clean" || statusRef.current === "saved") return
    if (savingRef.current) return
    void flush()
  }, [flush])

  // Clear the debounce on unmount.
  React.useEffect(() => clearTimer, [clearTimer])

  // Best-effort flush if the tab closes while dirty. A Server Action can't be
  // awaited in `beforeunload`, so this only fires the request and never blocks
  // navigation; the 2s debounce is the reliable path.
  React.useEffect(() => {
    if (!enabled) return
    const onBeforeUnload = () => {
      if (statusRef.current === "dirty" && !savingRef.current) {
        void saveCanvas({
          projectId: projectIdRef.current,
          snapshot: getSnapshotRef.current(),
        })
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [enabled])

  return { status, error, markDirty, saveNow }
}
