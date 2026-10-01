"use client"

import * as React from "react"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ChatMessage as ChatMessageType } from "./ai-types"

interface ChatMessageProps {
  message: ChatMessageType
  onRetry: (prompt: string) => void
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function UserMessage({ message }: { message: ChatMessageType }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-sm text-foreground">
        {message.content}
      </div>
      <span className="text-xs text-text-subtle">
        {formatTime(message.createdAt)}
      </span>
    </div>
  )
}

function AssistantMessage({
  message,
  onRetry,
}: {
  message: ChatMessageType
  onRetry: (prompt: string) => void
}) {
  return (
    <div className="flex gap-2">
      <Sparkles
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        strokeWidth={1.5}
      />
      <div className="min-w-0 flex-1">
        {message.status === "pending" && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Generating&hellip;</span>
          </div>
        )}
        {message.status === "success" && (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {message.content}
          </p>
        )}
        {message.status === "error" && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-state-error" />
              <span className="text-sm text-state-error">{message.content}</span>
            </div>
            {message.prompt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetry(message.prompt!)}
                className="self-start"
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const ChatMessageRow = React.memo(function ChatMessageRow({
  message,
  onRetry,
}: ChatMessageProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />
  }
  return <AssistantMessage message={message} onRetry={onRetry} />
})
