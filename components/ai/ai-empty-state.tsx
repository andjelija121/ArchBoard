"use client"

import { Sparkles } from "lucide-react"

const EXAMPLE_PROMPTS: string[] = [
  "Add an API Gateway, a User service, and a Postgres DB",
  "Create a microservice architecture with Redis cache and message queue",
  "Add a load balancer in front of three compute nodes",
]

interface AiEmptyStateProps {
  onPickExample: (text: string) => void
}

export function AiEmptyState({ onPickExample }: AiEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <Sparkles className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-center text-sm text-foreground">
        Describe your system and I&apos;ll scaffold it.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPickExample(prompt)}
            className="rounded-sm border border-border px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
