import { auth } from "@clerk/nextjs/server"

import { EditorShell } from "@/components/editor/editor-shell"

export default async function EditorPage() {
  await auth.protect()

  return <EditorShell />
}
