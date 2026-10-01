"use client"

import * as React from "react"
import { ArrowUp, PanelRightClose, Sparkles } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { AiEmptyState } from "./ai-empty-state"
import { ChatMessageRow } from "./chat-message"
import type { ChatMessage } from "./ai-types"

interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
  input: string
  onInputChange: (value: string) => void
  messages: ChatMessage[]
  isSending: boolean
  onSubmit: () => void
  onRetry: (prompt: string) => void
}

export function AiSidebar({
  isOpen,
  onClose,
  input,
  onInputChange,
  messages,
  isSending,
  onSubmit,
  onRetry,
}: AiSidebarProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const lastLen = messages.length
  const lastStatus = messages.length > 0 ? messages[messages.length - 1].status : null
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [lastLen, lastStatus])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      onSubmit()
    }
  }

  const handleTextareaChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    onInputChange(event.target.value)
    const el = event.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const handlePickExample = (text: string) => {
    onInputChange(text)
    textareaRef.current?.focus()
  }

  const canSend = input.trim().length > 0 && !isSending

  return (
    <>
      {/* Mobile backdrop scrim */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 ease-in-out lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        inert={!isOpen}
        className={cn(
          "flex h-full flex-col border-l border-border bg-card",
          "absolute inset-y-0 right-0 z-40 w-full max-w-90 transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          "lg:static lg:z-auto lg:w-full lg:max-w-none lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 text-primary"
              strokeWidth={1.5}
            />
            <h2 className="text-base font-semibold text-foreground">
              AI Assistant
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close AI assistant"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat history */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-3">
            {messages.length === 0 ? (
              <AiEmptyState onPickExample={handlePickExample} />
            ) : (
              messages.map((msg) => (
                <ChatMessageRow
                  key={msg.id}
                  message={msg}
                  onRetry={onRetry}
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="shrink-0 border-t border-border p-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Describe infrastructure to add&hellip;"
              aria-label="AI prompt"
              className="min-h-[4.5rem] resize-none pr-10 text-sm font-sans"
              rows={2}
            />
            <Button
              size="icon-sm"
              onClick={() => onSubmit()}
              disabled={!canSend}
              aria-label="Send prompt"
              className="absolute bottom-2 right-2"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-text-subtle">
            Enter to send &middot; Shift+Enter for a new line
          </p>
        </div>
      </aside>
    </>
  )
}
