import { auth } from "@clerk/nextjs/server"

import { EditorShell } from "@/components/editor/editor-shell"

import { getProjectLists } from "./_data"

export default async function EditorPage() {
  await auth.protect()
  const { userId } = await auth()
  if (!userId) return null

  const { ownedProjects, sharedProjects } = await getProjectLists(userId)

  return (
    <EditorShell
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
    />
  )
}
