"use server"

import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { canvasSnapshotSchema } from "@/lib/canvas"
import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

type ActionResult = { ok: true } | { ok: false; error: string }

const saveInput = z.object({
  projectId: z.string().min(1),
  snapshot: canvasSnapshotSchema,
})

export async function saveCanvas(input: unknown): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "Not signed in." }

  const parsed = saveInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    }
  }

  try {
    const result = await prisma.project.updateMany({
      where: { id: parsed.data.projectId, ownerId: userId },
      data: { canvas: parsed.data.snapshot as Prisma.InputJsonValue },
    })
    if (result.count === 0) return { ok: false, error: "Project not found." }
    // No revalidatePath: the canvas is client-owned live state, and re-running
    // the loader mid-session would clobber unsaved in-memory edits.
    return { ok: true }
  } catch (error) {
    console.error("saveCanvas failed", error)
    return { ok: false, error: "Couldn't save. Please try again." }
  }
}
