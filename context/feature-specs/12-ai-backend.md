# Unit 12: AI Generation Backend (Trigger.dev + Groq) + Node & Group Spawning

## Goal

Turn a chat-sidebar prompt into real smart nodes — and optionally
bounding-box groups — on the canvas. A Server Action hands the prompt to
a Trigger.dev background job and returns a run ID + scoped public token;
the job calls Groq with JSON-mode output, Zod-validates the returned
JSON against the node and group contracts, and returns the result; the
client subscribes to the run in real time and, on completion, **appends**
(never mutates) the generated nodes and groups into their swimlanes.
Typing "Create a microservice architecture with a cache layer" spawns
styled, draggable nodes in the correct columns, wrapped in labeled
bounding boxes, within seconds and with no UI freeze.

> **Scope.** This is the backend half of the AI feature; the sidebar UI
> is Unit 11 (`11-ai-sidebar.md`), already built. Per
> `ai-workflow-rules.md` the two were split so UI rendering and
> background-task execution are never introduced in the same unit. This
> unit owns `trigger/` (job + LLM call) and the Server Action handoff
> in `app/`; it reuses the Unit 08 node schema, Unit 10 group schema,
> and swimlane helper, and the Unit 11 hook seam.

## Design

This unit is mostly non-visual. Its visible result is **nodes and
groups appearing on the canvas** (styled by Units 08 and 10) and the
sidebar's existing **pending → success / error** states (styled by
Unit 11) now driven by a real run instead of the stub timer. No new
colors, tokens, or components are introduced.

### AI output schema

The model returns `{ nodes: [...], groups: [...] }`:

- **nodes**: array of `{ category, label, subLabel? }` — same as
  `smartNodeDataSchema` (Unit 08). Min 1, max 12.
- **groups** (optional): array of `{ label, color?, nodeIndices }` —
  each group names the nodes it wraps by 0-based index into the nodes
  array. Max 6 groups. Color is one of the Unit 10 group colors
  (slate, cyan, amber, green, purple); defaults to slate.

### Group spawning logic

When the model returns groups, `handleSpawnResult` in `board-editor.tsx`:

1. Creates all smart nodes first (same swimlane logic as before).
2. For each group, resolves `nodeIndices` to the created node IDs.
3. Calls `computeGroupBounds` on the member nodes to get the bounding
   box position and size.
4. Creates a group node (`type: "group"`, `zIndex: -1`) with
   `{ label, color, childIds }` data, prepended before members in the
   array so it draws behind them.

Groups are append-only: they never touch existing nodes or groups.

### Success-message copy

On a successful generation the assistant message shows:
`Added 5 nodes: API Gateway (Lb), User Service (Compute), ... Grouped into: Backend Services, Data Layer.`

### Error copy

Any failure path resolves the assistant message to `status: "error"`
with a plain sentence. If the user asks to create connections/edges,
the model returns an empty nodes array and the error explains that
only nodes can be added.

## Implementation

### 1. `lib/canvas.ts` — AI payload contract

```ts
export const MAX_GENERATED_NODES = 12
export const MAX_GENERATED_GROUPS = 6

export const generatedNodeSchema = smartNodeDataSchema
export type GeneratedNode = z.infer<typeof generatedNodeSchema>

export const generatedGroupSchema = z.object({
  label: z.string().min(1).max(80),
  color: z.enum(GROUP_COLORS).optional(),
  nodeIndices: z.array(z.number().int().min(0)).min(1),
})
export type GeneratedGroup = z.infer<typeof generatedGroupSchema>

export const generatedResultSchema = z.object({
  nodes: z.array(generatedNodeSchema).min(1).max(MAX_GENERATED_NODES),
  groups: z.array(generatedGroupSchema).max(MAX_GENERATED_GROUPS)
    .optional().default([]),
})
export type GeneratedResult = z.infer<typeof generatedResultSchema>
```

### 2. `trigger/generate-infra.ts` — background job (Groq)

The **only** LLM call site. Task id `generate-infra`, `retry.maxAttempts: 2`.
Uses `groq-sdk` with `response_format: { type: "json_object" }`, model
`openai/gpt-oss-120b` (configurable via `GROQ_MODEL`), temperature 0.4.

The system prompt teaches the model about both nodes (with category
mapping) and groups (with `nodeIndices` referencing the nodes array).
The response is normalized (handles bare arrays, `{ nodes }`, or
arbitrary wrapper keys) and Zod-validated against `generatedResultSchema`.

Output is `GenerateInfraOutput`: `{ ok: true, result }` or
`{ ok: false, error }`. Expected refusals (empty nodes, Groq
`json_validate_failed`) are returned as `ok: false` with a friendly
sentence. Anything else throws, so Trigger.dev retries it and then marks
the run FAILED; internal error text never reaches the user.

### 3. `app/editor/[projectId]/ai-actions.ts` — Server Action handoff

Clerk auth → Zod validation → owner-scoped Prisma check →
`tasks.trigger<typeof generateInfraTask>("generate-infra", { prompt }, { ttl: "90s" })`
→ returns `{ ok: true, runId, accessToken }` where `accessToken` is the
handle's run-scoped read token. Never awaits the LLM. The TTL makes a run
nobody picks up (worker not running) expire instead of pending forever.

### 4. `components/ai/use-ai-sidebar.ts` — realtime subscription

`submit` calls the action; on `ok` it stores the run (ref + state) and
the pending message stays pending. `useRealtimeRun` follows the run and
`onComplete` settles it, once (`finish` is a no-op after the first call):

- `COMPLETED`: `run.output` is validated again (`ok: true` → `onSpawn(result)`
  and success message; `ok: false` → that message as an error).
- `EXPIRED` → "The generator didn't pick this up in time…"; `TIMED_OUT` →
  "Generation timed out…"; any other terminal status → "Generation failed…".
- Subscription error → "Lost connection to the generator. Please retry."

If the action itself rejects, or returns `ok: false`, the message becomes
an error and `isSending` clears so Retry is never blocked.

`UseAiSidebar` return type unchanged. `UseAiSidebarOptions` accepts
`onSpawn: (result: GeneratedResult) => void`.

### 5. `components/canvas/board-editor.tsx` — spawn nodes + groups

`handleSpawnResult` creates nodes via `nextLanePosition`, then for
each group computes bounds via `computeGroupBounds` and creates a
group node. Groups are prepended, nodes appended (DOM order: box
behind members). `markDirty()` so spawned elements persist via the
existing Unit 07 save path.

### 6. Environment

| Var | Used by | Where to get it |
| --- | --- | --- |
| `TRIGGER_SECRET_KEY` | Server Action (Next.js env) | Trigger.dev dashboard |
| `GROQ_API_KEY` | `trigger/generate-infra.ts` (read by the Trigger.dev worker) | console.groq.com/keys |
| `GROQ_MODEL` *(optional)* | trigger task | default `openai/gpt-oss-120b` |

Locally the worker is `npx trigger.dev@4.7.0 dev`; it loads `.env.local`.
For a deployed environment, `GROQ_API_KEY` must be set in the Trigger.dev
project's environment variables, not only in Vercel.

### Failure taxonomy

| Cause | Message shown |
| --- | --- |
| Not signed in | "You're signed out. Sign in and try again." |
| Not the owner / missing | "Project not found." |
| Empty/too-long prompt | Zod message |
| Couldn't enqueue job | "Couldn't start generation. Please try again." |
| Server Action rejects (network/server) | "Couldn't reach the generator. Please try again." |
| Empty nodes / Groq `json_validate_failed` | "I can only add infrastructure nodes..." |
| Other Groq error, bad JSON, or schema failure (including out-of-range group indices) | run FAILED → "Generation failed. Please try again." |
| Run expired in the queue | "The generator didn't pick this up in time. Make sure it's running, then retry." |
| Run timed out | "Generation timed out. Please try again." |
| Subscription error | "Lost connection to the generator. Please retry." |

## Dependencies

- `@trigger.dev/sdk` — background job orchestration
- `@trigger.dev/react-hooks` — `useRealtimeRun` subscription
- `@trigger.dev/build` (dev) — Trigger.dev build tooling
- `groq-sdk` — Groq LLM client
- `zod` — already installed

## Verify when done

- [ ] "Add an API Gateway, a User service, and a Postgres DB" spawns
      three nodes in correct swimlane columns.
- [ ] "Create a microservice architecture with Redis cache" spawns nodes
      AND groups wrapping related nodes.
- [ ] Groups have correct bounds, labels, and colors from the AI.
- [ ] While generating, the assistant shows pending state; on completion
      the success message lists nodes and groups.
- [ ] Existing nodes/groups are untouched (append-only).
- [ ] Edge/connection prompts get a helpful error message.
- [ ] Each error path renders correctly; Retry works.
- [ ] Non-owner gets "Project not found."
- [ ] After spawn, save status is `dirty`; Save + reload rehydrates.
- [ ] `UseAiSidebar` return type unchanged; all Unit 11 views compile.
- [ ] `npm run build` passes; no TypeScript errors.
