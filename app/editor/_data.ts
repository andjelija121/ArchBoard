import { currentUser } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"
import type { ProjectListItem } from "@/lib/projects"

const listSelect = { id: true, name: true, slug: true } as const

/** Owned + shared project lists for the editor sidebar. */
export async function getProjectLists(userId: string): Promise<{
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
}> {
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress

  const [owned, shared] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: listSelect,
    }),
    email
      ? prisma.project.findMany({
          where: { collaborators: { some: { collaboratorEmail: email } } },
          orderBy: { createdAt: "desc" },
          select: listSelect,
        })
      : Promise.resolve([]),
  ])

  return {
    ownedProjects: owned.map((project) => ({ ...project, owner: true })),
    sharedProjects: shared.map((project) => ({ ...project, owner: false })),
  }
}
