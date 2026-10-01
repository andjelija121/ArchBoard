"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { createMessageId, type ChatMessage } from "./ai-types"

const STUB_DELAY_MS = 1200
const STUB_REPLY =
  "Connected in Unit 12 — this is where generated nodes will be summarized."

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

export function useAiSidebar(): UseAiSidebar {
  const isDesktop = useSyncExternalStore(
    subscribeLg,
    getLgSnapshot,
    getLgServerSnapshot
  )
  // null = user hasn't toggled yet, use isDesktop as default
  const [userChoice, setUserChoice] = useState<boolean | null>(null)
  const isOpen = userChoice ?? isDesktop
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const open = useCallback(() => setUserChoice(true), [])
  const close = useCallback(() => setUserChoice(false), [])
  const toggle = useCallback(
    () => setUserChoice((prev) => !(prev ?? isDesktop)),
    [isDesktop]
  )

  const submit = useCallback(
    (prompt?: string) => {
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

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, status: "success" as const, content: STUB_REPLY }
              : m
          )
        )
        setIsSending(false)
      }, STUB_DELAY_MS)
    },
    [input, isSending]
  )

  const retry = useCallback(
    (prompt: string) => {
      submit(prompt)
    },
    [submit]
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
