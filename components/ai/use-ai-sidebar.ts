"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { z } from "zod"

import { generateNodes } from "@/app/editor/[projectId]/ai-actions"
import { generatedResultSchema, type GeneratedResult } from "@/lib/canvas"
import type { generateInfraTask } from "@/trigger/generate-infra"

import { createMessageId, type ChatMessage } from "./ai-types"

interface ActiveRun {
  runId: string
  accessToken: string
  assistantId: string
}

// The slice of a realtime run that settlement reads.
interface TrackedRun {
  id: string
  status: string
  output?: unknown
}

// Validated here, not trusted: this is the boundary where task output enters
// the client before it is allowed to spawn anything on the canvas.
const taskOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: generatedResultSchema }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  "COMPLETED",
  "CANCELED",
  "FAILED",
  "CRASHED",
  "INTERRUPTED",
  "SYSTEM_FAILURE",
  "EXPIRED",
  "TIMED_OUT",
])

const GENERIC_ERROR = "Generation failed. Please try again."
const SUBSCRIPTION_ERROR = "Lost connection to the generator. Please retry."

const LG_QUERY = "(min-width: 1024px)"
function subscribeLg(onStoreChange: () => void) {
  const mql = window.matchMedia(LG_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}
function getLgSnapshot() {
  return window.matchMedia(LG_QUERY).matches
}
function getLgServerSnapshot() {
  return false
}

export interface UseAiSidebarOptions {
  projectId: string
  onSpawn: (result: GeneratedResult) => void
}

export interface UseAiSidebar {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void

  input: string
  setInput: (value: string) => void

  messages: ChatMessage[]
  isSending: boolean
  submit: (prompt?: string) => void
  retry: (prompt: string) => void
}

function buildSuccessMessage(result: GeneratedResult): string {
  const nodeItems = result.nodes
    .map((n) => {
      const cat = n.category.charAt(0).toUpperCase() + n.category.slice(1)
      return `${n.label} (${cat})`
    })
    .join(", ")
  let msg = `Added ${result.nodes.length} node${result.nodes.length === 1 ? "" : "s"}: ${nodeItems}.`
  if (result.groups && result.groups.length > 0) {
    const groupNames = result.groups.map((g) => g.label).join(", ")
    msg += ` Grouped into: ${groupNames}.`
  }
  return msg
}

export function useAiSidebar(options: UseAiSidebarOptions): UseAiSidebar {
  const isDesktop = useSyncExternalStore(
    subscribeLg,
    getLgSnapshot,
    getLgServerSnapshot,
  )
  const [userChoice, setUserChoice] = useState<boolean | null>(null)
  const isOpen = userChoice ?? isDesktop
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)

  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const open = useCallback(() => setUserChoice(true), [])
  const close = useCallback(() => setUserChoice(false), [])
  const toggle = useCallback(
    () => setUserChoice((prev) => !(prev ?? isDesktop)),
    [isDesktop],
  )

  // The run being followed. The ref is the source of truth for callbacks; the
  // state only drives the subscription (id, token, enabled).
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const activeRunRef = useRef<ActiveRun | null>(null)

  // Resolves the pending assistant message and releases the composer. A no-op
  // once the run is settled, so a duplicate completion callback does nothing.
  const finish = useCallback(
    (patch: Pick<ChatMessage, "status" | "content">) => {
      const current = activeRunRef.current
      if (!current) return
      activeRunRef.current = null
      setActiveRun(null)
      setMessages((prev) =>
        prev.map((m) => (m.id === current.assistantId ? { ...m, ...patch } : m)),
      )
      setIsSending(false)
    },
    [],
  )

  // The one place a run is settled. onComplete, the hook's reactive run state
  // and its subscription error all route here, so none of them can be missed
  // (onComplete alone isn't guaranteed to fire). A run that isn't the active
  // one, or is already settled, is ignored.
  const settleRun = useCallback(
    (run: TrackedRun | undefined, err?: Error) => {
      const current = activeRunRef.current
      if (!current || (run && run.id !== current.runId)) return

      if (err) {
        console.error("useAiSidebar: realtime subscription failed", err)
        finish({ status: "error", content: SUBSCRIPTION_ERROR })
        return
      }
      if (!run || !TERMINAL_STATUSES.has(run.status)) return

      if (run.status === "COMPLETED") {
        const output = taskOutputSchema.safeParse(run.output)
        if (!output.success) {
          console.error("useAiSidebar: invalid task output", output.error)
          finish({ status: "error", content: GENERIC_ERROR })
        } else if (output.data.ok) {
          optionsRef.current.onSpawn(output.data.result)
          finish({
            status: "success",
            content: buildSuccessMessage(output.data.result),
          })
        } else {
          finish({ status: "error", content: output.data.error })
        }
        return
      }

      finish({
        status: "error",
        content:
          run.status === "EXPIRED"
            ? "The generator didn't pick this up in time. Make sure it's running, then retry."
            : run.status === "TIMED_OUT"
              ? "Generation timed out. Please try again."
              : GENERIC_ERROR,
      })
    },
    [finish],
  )

  // `id` is the hook's cache key: one per run, so a later run never starts
  // from the previous run's cached state.
  const { run: liveRun, error: liveError } = useRealtimeRun<
    typeof generateInfraTask
  >(activeRun?.runId, {
    id: activeRun?.runId,
    accessToken: activeRun?.accessToken,
    enabled: activeRun !== null,
    onComplete: settleRun,
  })

  useEffect(() => {
    if (!activeRun) return
    settleRun(liveRun, liveError)
  }, [activeRun, liveRun, liveError, settleRun])

  const submit = useCallback(
    async (prompt?: string) => {
      const text = (prompt ?? input).trim()
      if (!text || isSending) return

      const userMsg: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: text,
        status: "success",
        createdAt: Date.now(),
      }
      const assistantId = createMessageId()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "pending",
        prompt: text,
        createdAt: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput("")
      setIsSending(true)

      const fail = (content: string) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: "error" as const, content } : m,
          ),
        )

      try {
        const res = await generateNodes({
          projectId: optionsRef.current.projectId,
          prompt: text,
        })

        if (res.ok) {
          // The run now owns the pending message; it settles via onComplete.
          const run = {
            runId: res.runId,
            accessToken: res.accessToken,
            assistantId,
          }
          activeRunRef.current = run
          setActiveRun(run)
          return
        }
        fail(res.error)
      } catch (error) {
        console.error("useAiSidebar: generateNodes rejected", error)
        fail("Couldn't reach the generator. Please try again.")
      }
      setIsSending(false)
    },
    [input, isSending],
  )

  const retry = useCallback(
    (prompt: string) => {
      void submit(prompt)
    },
    [submit],
  )

  return {
    isOpen,
    open,
    close,
    toggle,
    input,
    setInput,
    messages,
    isSending,
    submit,
    retry,
  }
}
