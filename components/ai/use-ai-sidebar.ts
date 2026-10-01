"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { generateNodes } from "@/app/editor/[projectId]/ai-actions"
import type { GeneratedResult } from "@/lib/canvas"

import { createMessageId, type ChatMessage } from "./ai-types"

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

      const res = await generateNodes({
        projectId: optionsRef.current.projectId,
        prompt: text,
      })

      if (res.ok) {
        optionsRef.current.onSpawn(res.result)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, status: "success" as const, content: buildSuccessMessage(res.result) }
              : m,
          ),
        )
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, status: "error" as const, content: res.error }
              : m,
          ),
        )
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
