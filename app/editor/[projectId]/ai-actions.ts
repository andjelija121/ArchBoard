"use server"

import { auth } from "@clerk/nextjs/server"
import Groq from "groq-sdk"
import { z } from "zod"

import {
  GROUP_COLORS,
  generatedResultSchema,
  MAX_GENERATED_GROUPS,
  MAX_GENERATED_NODES,
  NODE_CATEGORIES,
  type GeneratedResult,
} from "@/lib/canvas"
import { prisma } from "@/lib/prisma"

type GenerateResult =
  | { ok: true; result: GeneratedResult }
  | { ok: false; error: string }

const generateInput = z.object({
  projectId: z.string().min(1),
  prompt: z.string().trim().min(1, "Enter a prompt.").max(1000),
})

const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"

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

function extractResult(json: unknown): { nodes: unknown[]; groups?: unknown[] } {
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

export async function generateNodes(input: unknown): Promise<GenerateResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "You're signed out. Sign in and try again." }

  const parsed = generateInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ownerId: userId },
    select: { id: true },
  })
  if (!project) return { ok: false, error: "Project not found." }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: parsed.data.prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    })

    const text = response.choices[0]?.message?.content ?? "{}"
    const rawJson: unknown = JSON.parse(text)
    const obj = extractResult(rawJson)

    if (obj.nodes.length === 0) {
      return { ok: false, error: "I can only add infrastructure nodes. I can't create connections — drag between node handles to connect them." }
    }

    const result = generatedResultSchema.parse(obj)
    return { ok: true, result }
  } catch (error) {
    console.error("generateNodes: Groq call failed", error)
    if (error instanceof Error && error.message.includes("json_validate_failed")) {
      return { ok: false, error: "I can only add infrastructure nodes. Try something like \"Add a Redis cache and a message queue\"." }
    }
    return { ok: false, error: "Generation failed. Please try again." }
  }
}
