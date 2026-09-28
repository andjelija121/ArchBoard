import { EditorShell } from "@/components/editor/editor-shell"

/** Renders the editor shell with a placeholder for the unfinished canvas. */
export default function EditorPage() {
  return (
    <EditorShell>
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Canvas not built yet.</p>
      </div>
    </EditorShell>
  )
}
