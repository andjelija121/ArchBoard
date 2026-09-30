import { auth, currentUser } from "@clerk/nextjs/server"

import { EditorShell } from "@/components/editor/editor-shell"
import { prisma } from "@/lib/prisma"
import type { ProjectListItem } from "@/lib/projects"

const listSelect = { id: true, name: true, slug: true } as const

export default async function EditorPage() {
  await auth.protect()
  const { userId } = await auth()
  if (!userId) return null

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

  const ownedProjects: ProjectListItem[] = owned.map((project) => ({
    ...project,
    owner: true,
  }))
  const sharedProjects: ProjectListItem[] = shared.map((project) => ({
    ...project,
    owner: false,
  }))

  return (
    <EditorShell
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
    />
  )
}
