"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/projects"

type ActionResult = { ok: true } | { ok: false; error: string }

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(100, "Name is too long.")

const createInput = z.object({ name: nameSchema })
const renameInput = z.object({ id: z.string().min(1), name: nameSchema })
const deleteInput = z.object({ id: z.string().min(1) })

const NOT_SIGNED_IN: ActionResult = { ok: false, error: "Not signed in." }
const NOT_FOUND: ActionResult = { ok: false, error: "Project not found." }
const GENERIC_ERROR: ActionResult = {
  ok: false,
  error: "Something went wrong. Please try again.",
}

function firstIssue(error: z.ZodError): ActionResult {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input." }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

/**
 * First free slug for this owner: `base`, then `base-2`, `base-3`, …
 * The DB unique constraint on (ownerId, slug) is the final arbiter.
 */
async function generateUniqueSlug(
  ownerId: string,
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name) || "project"
  const existing = await prisma.project.findMany({
    where: {
      ownerId,
      slug: { startsWith: base },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { slug: true },
  })
  const taken = new Set(existing.map((project) => project.slug))

  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

export async function createProject(input: unknown): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return NOT_SIGNED_IN

  const parsed = createInput.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  try {
    // A concurrent create with the same name can race past the slug check;
    // the unique constraint rejects it, so recompute once and retry.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const slug = await generateUniqueSlug(userId, parsed.data.name)
        await prisma.project.create({
          data: { ownerId: userId, name: parsed.data.name, slug },
        })
        revalidatePath("/editor")
        return { ok: true }
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 1) throw error
      }
    }
    return GENERIC_ERROR
  } catch (error) {
    console.error("createProject failed", error)
    return GENERIC_ERROR
  }
}

export async function renameProject(input: unknown): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return NOT_SIGNED_IN

  const parsed = renameInput.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)
  const { id, name } = parsed.data

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const slug = await generateUniqueSlug(userId, name, id)
        const result = await prisma.project.updateMany({
          where: { id, ownerId: userId },
          data: { name, slug },
        })
        if (result.count === 0) return NOT_FOUND
        revalidatePath("/editor")
        return { ok: true }
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 1) throw error
      }
    }
    return GENERIC_ERROR
  } catch (error) {
    console.error("renameProject failed", error)
    return GENERIC_ERROR
  }
}

export async function deleteProject(input: unknown): Promise<ActionResult> {
  const { userId } = await auth()
  if (!userId) return NOT_SIGNED_IN

  const parsed = deleteInput.safeParse(input)
  if (!parsed.success) return firstIssue(parsed.error)

  try {
    const result = await prisma.project.deleteMany({
      where: { id: parsed.data.id, ownerId: userId },
    })
    if (result.count === 0) return NOT_FOUND
    revalidatePath("/editor")
    return { ok: true }
  } catch (error) {
    console.error("deleteProject failed", error)
    return GENERIC_ERROR
  }
}
