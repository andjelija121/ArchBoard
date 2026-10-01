"use server"

import { auth } from "@clerk/nextjs/server"
import { tasks } from "@trigger.dev/sdk"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import type { generateInfraTask } from "@/trigger/generate-infra"

type StartGenerationResult =
  | { ok: true; runId: string; accessToken: string }
  | { ok: false; error: string }

const generateInput = z.object({
  projectId: z.string().min(1),
  prompt: z.string().trim().min(1, "Enter a prompt.").max(1000),
})

/**
 * Hands the prompt to the `generate-infra` Trigger.dev task and returns right
 * away. The LLM call never runs here (architecture invariant #2); the client
 * follows the run with the returned run-scoped read token.
 */
export async function generateNodes(
  input: unknown
): Promise<StartGenerationResult> {
  const { userId } = await auth()
  if (!userId) {
    return { ok: false, error: "You're signed out. Sign in and try again." }
  }

  const parsed = generateInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    }
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ownerId: userId },
    select: { id: true },
  })
  if (!project) return { ok: false, error: "Project not found." }

  try {
    const handle = await tasks.trigger<typeof generateInfraTask>(
      "generate-infra",
      { prompt: parsed.data.prompt },
      // A run nobody picks up (e.g. the dev worker isn't running) expires and
      // reaches the client as an error instead of spinning forever.
      { ttl: "90s" }
    )
    return {
      ok: true,
      runId: handle.id,
      accessToken: handle.publicAccessToken,
    }
  } catch (error) {
    console.error("generateNodes: could not enqueue generate-infra", error)
    return {
      ok: false,
      error: "Couldn't start generation. Please try again.",
    }
  }
}
