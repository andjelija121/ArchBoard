import { auth } from "@clerk/nextjs/server"

import { EditorShell } from "@/components/editor/editor-shell"

export default async function EditorPage() {
  await auth.protect()

  return (
    <EditorShell>
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Canvas not built yet.</p>
      </div>
    </EditorShell>
  )
}
