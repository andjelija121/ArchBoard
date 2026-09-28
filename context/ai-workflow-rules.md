# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. Context files (`project-overview.md`, `architecture.md`, `code-standards.md`) define what to build, how to build it, and the constraints of the system. Always implement against these specs—do not infer or invent behavior from scratch.

## Scoping Rules

* Work strictly on one feature unit at a time.
* Prefer small, verifiable increments over large, speculative changes.
* Do not combine unrelated system boundaries (e.g., mixing Liveblocks real-time hooks with Prisma database schema definitions) in a single implementation step.

## When to Split Work

Split an implementation step immediately if it combines:

* UI rendering changes and background task / Trigger.dev execution logic.
* Multiple unrelated API routes or distinct system boundaries.
* Behavior or schemas not clearly defined in the architecture and project overview documents.

If a change cannot be verified end-to-end quickly, the scope is too broad—split it.

## Handling Missing Requirements

* Do not invent product behavior not defined in the context files.
* If a requirement is ambiguous, pause and ask for clarification, or resolve it in the relevant context file before writing implementation code.
* If a requirement is missing, add it as an open question or task item in `progress-tracker.md` before continuing.

## Protected Files

Do not modify the following files or directories unless explicitly instructed:

* `components/ui/*` — Generated UI library primitives (shadcn/ui or equivalent base components).
* `prisma/migrations/*` — Existing historical database migrations.
* Any third-party library internals or lock files (`package-lock.json` / `pnpm-lock.yaml`) unless explicitly modifying project dependencies.

## Keeping Docs in Sync

Update the relevant context file immediately whenever implementation changes affect:

* System architecture, folder boundaries, or storage models.
* Code conventions, strict TypeScript rules, or linting standards.
* Feature scope, UI swimlane parameters, or API communication protocols.

## Before Moving to the Next Unit

1. The current unit works end-to-end within its defined scope without breaking existing routes or components.
2. No invariant defined in `architecture.md` was violated (e.g., no direct synchronous LLM calls in Server Actions, AI append-only rule maintained).
3. `progress-tracker.md` reflects the completed work item.
4. `npm run build` and type-checking pass completely with zero TypeScript errors.
</content>
