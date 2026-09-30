import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { BoardEditor } from "@/components/canvas/board-editor"
import { parseCanvas } from "@/lib/canvas"
import { prisma } from "@/lib/prisma"

import { getProjectLists } from "../_data"

interface BoardPageProps {
  params: Promise<{ projectId: string }>
}

export default async function BoardPage({ params }: BoardPageProps) {
  await auth.protect()
  const { userId } = await auth()
  if (!userId) return null

  const { projectId } = await params

  // Owner-scoped: another user's board (or a bad id) is simply not found.
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true, name: true, canvas: true },
  })
  if (!project) notFound()

  const { ownedProjects, sharedProjects } = await getProjectLists(userId)

  return (
    <BoardEditor
      projectId={project.id}
      projectName={project.name}
      initialSnapshot={parseCanvas(project.canvas)}
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
    />
  )
}
