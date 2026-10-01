import { task } from "@trigger.dev/sdk"
import Groq from "groq-sdk"

import {
  GROUP_COLORS,
  generatedResultSchema,
  MAX_GENERATED_GROUPS,
  MAX_GENERATED_NODES,
  NODE_CATEGORIES,
} from "@/lib/canvas"

const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b"

const SYSTEM_PROMPT = `You are an infrastructure diagram scaffolder.
You add ONLY the components the user asks for — nothing more, nothing less.

Output JSON: { "nodes": [...], "groups": [...] }

Each node: { "category": one of ${NODE_CATEGORIES.join(", ")}, "label": string (max 80 chars), "subLabel"?: string (max 80 chars) }

Each group (optional): { "label": string (max 80 chars), "color"?: one of ${GROUP_COLORS.join(", ")}, "nodeIndices": number[] (0-based indices into nodes array) }

Category mapping:
- gateways/reverse proxies/ingress => "lb"
- services/APIs/workers/servers => "compute"
- SQL/NoSQL stores => "database"
- Redis/Memcached/CDNs => "cache"
- Kafka/RabbitMQ/SQS/event buses => "queue"
- browsers/mobile/end-user apps => "client"

CRITICAL RULES:
- Output EXACTLY what was requested. "add a database" = 1 database node. "add 3 services" = 3 compute nodes.
- For architecture requests (e.g. "microservice architecture for X"), design components specific to that domain.
- Use groups only when the prompt implies logical grouping or architecture-level organization.
- A node belongs to at most one group.
- If asked to create connections/edges/links, return { "nodes": [] }.
- Max ${MAX_GENERATED_NODES} nodes, max ${MAX_GENERATED_GROUPS} groups.`

export const generateInfraTask = task({
  id: "generate-infra",
  run: async (payload: { prompt: string }) => {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: payload.prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    })

    const text = response.choices[0]?.message?.content ?? "{}"
    const rawJson: unknown = JSON.parse(text)
    const obj = normalizeResponse(rawJson)
    const result = generatedResultSchema.parse(obj)

    return result
  },
})

function normalizeResponse(json: unknown): { nodes: unknown[]; groups?: unknown[] } {
  if (Array.isArray(json)) return { nodes: json }
  if (json && typeof json === "object") {
    const rec = json as Record<string, unknown>
    if (Array.isArray(rec.nodes)) {
      return { nodes: rec.nodes, groups: Array.isArray(rec.groups) ? rec.groups : undefined }
    }
    for (const val of Object.values(rec)) {
      if (Array.isArray(val)) return { nodes: val }
    }
  }
  return { nodes: [] }
}
