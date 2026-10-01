# Architecture Context

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Core application framework, routing, API endpoints, and server actions. |
| UI & Canvas | Tailwind CSS + React Flow | Styling, interactive node-based canvas, custom smart blocks, and custom edges. |
| Auth | Clerk | User authentication, OAuth (GitHub/Google), and session management for board owners. |
| Database | PostgreSQL + Prisma | Persistent relational storage for user data, board metadata, and canvas JSON state. |
| Multiplayer | Liveblocks | Real-time WebSocket synchronization, cursor tracking, and volatile session state management. |
| Background Tasks | Trigger.dev | Orchestrating AI generation calls outside of the main Next.js thread to avoid serverless timeouts. |
| AI Engine | Groq (`groq-sdk`, default `openai/gpt-oss-120b`, configurable via `GROQ_MODEL` env var) | Generating structured JSON for infrastructure nodes and groups based on user text prompts. |

## System Boundaries

* `app/` — Owns all Next.js routing, layout definitions, page components, and Server Actions.
* `components/canvas/` — Owns the React Flow implementation, including custom nodes (Compute, DB, etc.), custom edges, and the edge property side-panel.
* `components/ai/` — Owns the persistent chat sidebar UI and localized prompt state management.
* `lib/liveblocks/` — Owns the multiplayer room configuration, WebSocket connection hooks, and sync logic.
* `trigger/` — Owns the Trigger.dev background task definitions and LLM API interactions.
* `prisma/` — Owns the database schema, migrations, and ORM client generation.

## Storage Model

* **PostgreSQL (Database)**: Owns persistent application state. Stores user profiles, board metadata (ID, owner, title, timestamps), and the canonical saved snapshots of the React Flow canvas (stored efficiently in a single `JSONB` column per board).
* **Liveblocks (In-Memory/WebSocket)**: Owns the active, volatile session state. When a board is open, the canvas state lives here to sync drag-and-drop actions in milliseconds across connected clients. Flushes to PostgreSQL on explicit save or auto-save intervals.

## Auth and Access Model

* **Authentication**: Board creators (owners) must authenticate via Clerk using GitHub or Google.
* **Ownership**: Every project board has a single owner, enforced by a `user_id` foreign key in the database.
* **Frictionless Share Links**: The owner shares a board by generating a **revocable share link** carrying a random, unguessable token (not the raw board id). Each link has a **role**: `VIEW` (read-only) or `EDIT`. A guest opening an `EDIT` link joins instantly as an anonymous editor (spawn blocks, move nodes, edit edge properties in real-time) with **no account required**; a `VIEW` link is read-only. The owner can **revoke** any link at any time, immediately cutting off access. Only the authenticated owner can permanently delete the board. The board route is not publicly reachable by its id alone — anonymous access is granted only through an active share token. The `/share/[token]` request sets an httpOnly cookie (in `proxy.ts`) that `/api/liveblocks-auth` checks against an active `ShareLink` for the exact room before minting a guest token (`room:write` for `EDIT`, `room:read` + `room:presence:write` for `VIEW`). Guests never write to PostgreSQL; persistence stays owner-scoped.

## AI and Background Task Model

* User prompts from the chat sidebar are sent to the `generateNodes` Server Action (`app/editor/[projectId]/ai-actions.ts`). It authenticates, validates, checks ownership, hands the prompt to the `generate-infra` Trigger.dev task (90s queue TTL), and returns `{ ok: true, runId, accessToken }` (the token is read-scoped to that run). It never awaits the LLM.
* The `generate-infra` task (`trigger/generate-infra.ts`) is the only LLM call site. It calls Groq in JSON mode and Zod-validates the response against `generatedResultSchema`, which guarantees a payload matching the node and group schemas (including that every group `nodeIndices` entry points at a returned node). Expected refusals (e.g. a request for edges) are returned as `{ ok: false, error }`; unexpected failures throw, are retried once, and mark the run FAILED.
* The AI assigns a `category` (e.g., "Gateway", "Database") to each generated node. The frontend UI uses this category to calculate the X-coordinate for "swimlane" spawning. The AI can also return optional groups that wrap related nodes in bounding boxes (Unit 10).
* The client follows the run with `useRealtimeRun` (SSE), re-validates the task output with `generatedResultSchema`, and spawns nodes/groups on completion.

## Invariants

1. **AI Append-Only Rule**: The AI backend must never mutate, edit, or delete existing nodes or edges on the canvas. It is strictly an append-only scaffolding generator.
2. **Synchronous LLM Ban**: No direct, synchronous LLM network calls are permitted within Next.js API routes or Server Actions. All AI requests must be delegated to Trigger.dev to prevent Vercel serverless function timeouts.3. **Single Source of Truth (Active Session)**: During an active collaboration session, Liveblocks is the absolute source of truth for the canvas. The PostgreSQL database is only used for initial loading and persistent snapshot saving, never for real-time state calculation.
4. **Denormalized Canvas State**: Canvas data (nodes and edges) must always be stored in the database as a single `JSONB` object payload. The codebase must never attempt to normalize canvas nodes and edges into separate SQL tables, as this would break the React Flow and Liveblocks syncing mechanisms.
</content>
