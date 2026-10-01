import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  project: "proj_czwrsouisxyaduohbjcl",
  // Task files live in trigger/ at the repo root, matching the `trigger/`
  // boundary in architecture.md / code-standards.md (this project has no src/).
  dirs: ["./trigger"],
  maxDuration: 60, // seconds — a Gemini Flash call is well under this
})
