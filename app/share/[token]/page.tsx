import { AlertCircle } from "lucide-react"

import { BoardEditor } from "@/components/canvas/board-editor"
import { parseCanvas } from "@/lib/canvas"
import { prisma } from "@/lib/prisma"

interface SharePageProps {
  params: Promise<{ token: string }>
}

/**
 * The one anonymous entry point to a board: no `auth.protect()`. The token
 * cookie the Liveblocks auth endpoint reads is set by `proxy.ts`.
 */
export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params

  const link = await prisma.shareLink.findFirst({
    where: { token, revokedAt: null },
    select: {
      role: true,
      project: { select: { id: true, name: true, canvas: true } },
    },
  })

  // Revoked, unknown and malformed tokens look the same on purpose.
  if (!link) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-state-error" strokeWidth={1.5} />
        <p>This link is no longer active</p>
      </div>
    )
  }

  return (
    <BoardEditor
      projectId={link.project.id}
      projectName={link.project.name}
      initialSnapshot={parseCanvas(link.project.canvas)}
      access={link.role === "EDIT" ? "edit" : "view"}
    />
  )
}
