export type ChatRole = "user" | "assistant"
export type GenerationStatus = "pending" | "success" | "error"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  status: GenerationStatus
  prompt?: string
  createdAt: number
}

export function createMessageId(): string {
  return `m_${crypto.randomUUID()}`
}
