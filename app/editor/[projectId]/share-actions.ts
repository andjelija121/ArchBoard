"use server"

import { auth } from "@clerk/nextjs/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { createShareToken, type ShareLinkItem } from "@/lib/share"

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

const createInput = z.object({
  projectId: z.string().min(1),
  role: z.enum(["VIEW", "EDIT"]),
})
const revokeInput = z.object({
  projectId: z.string().min(1),
  linkId: z.string().min(1),
})
const listInput = z.string().min(1)

const GENERIC_ERROR = {
  ok: false,
  error: "Something went wrong. Please try again.",
} as const

const linkSelect = {
  id: true,
  token: true,
  role: true,
  createdAt: true,
} as const

function serialize(link: {
  id: string
  token: string
  role: "VIEW" | "EDIT"
  createdAt: Date
}): ShareLinkItem {
  return {
    id: link.id,
    token: link.token,
    role: link.role,
    createdAt: link.createdAt.toISOString(),
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

async function isOwner(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true },
  })
  return project !== null
}

export async function createShareLink(
  input: unknown
): Promise<ActionResult<{ link: ShareLinkItem }>> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "Not signed in." }

  const parsed = createInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    }
  }
  const { projectId, role } = parsed.data

  try {
    if (!(await isOwner(projectId, userId))) {
      return { ok: false, error: "Project not found." }
    }

    // A token collision is astronomically unlikely, but the unique constraint
    // is the final arbiter, so retry once with a fresh token.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const link = await prisma.shareLink.create({
          data: { projectId, role, token: createShareToken() },
          select: linkSelect,
        })
        return { ok: true, link: serialize(link) }
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 1) throw error
      }
    }
    return GENERIC_ERROR
  } catch (error) {
    console.error("createShareLink failed", error)
    return GENERIC_ERROR
  }
}

export async function revokeShareLink(input: unknown): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "Not signed in." }

  const parsed = revokeInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    }
  }
  const { projectId, linkId } = parsed.data

  try {
    if (!(await isOwner(projectId, userId))) {
      return { ok: false, error: "Project not found." }
    }

    // Soft delete: the row stays for the audit trail and keeps the token unique.
    // A zero count is another user's id or an already-revoked link: a no-op.
    const result = await prisma.shareLink.updateMany({
      where: {
        id: linkId,
        revokedAt: null,
        project: { id: projectId, ownerId: userId },
      },
      data: { revokedAt: new Date() },
    })
    if (result.count === 0) return { ok: false, error: "Link not found." }
    // No revalidatePath: it would re-run the board loader mid-session.
    return { ok: true }
  } catch (error) {
    console.error("revokeShareLink failed", error)
    return GENERIC_ERROR
  }
}

export async function listShareLinks(
  projectId: unknown
): Promise<ActionResult<{ links: ShareLinkItem[] }>> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "Not signed in." }

  const parsed = listInput.safeParse(projectId)
  if (!parsed.success) return { ok: false, error: "Invalid input." }

  try {
    const links = await prisma.shareLink.findMany({
      where: {
        revokedAt: null,
        project: { id: parsed.data, ownerId: userId },
      },
      orderBy: { createdAt: "desc" },
      select: linkSelect,
    })
    return { ok: true, links: links.map(serialize) }
  } catch (error) {
    console.error("listShareLinks failed", error)
    return GENERIC_ERROR
  }
}
