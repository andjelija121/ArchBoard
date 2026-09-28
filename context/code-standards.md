# Code Standards

## General

* Keep modules small and single-purpose; do not mix multiplayer synchronization logic with UI rendering code.
* Fix root causes, do not layer workarounds; if React Flow nodes are misaligned, fix the spawning coordinate calculation rather than adding arbitrary CSS offsets.
* Handle external failures gracefully; if the AI generation fails or Liveblocks disconnects, display a clear fallback UI rather than throwing unhandled exceptions.

## TypeScript

* Strict mode is required throughout the project (`"strict": true` in `tsconfig.json`).
* Avoid `any` entirely; use explicit interfaces or narrowly scoped types for all React Flow nodes, edges, and database models.
* Validate unknown external input at system boundaries before trusting it; use Zod to validate the JSON payload returning from the Gemini API before attempting to render it on the canvas.

## Next.js (App Router)

* Default to Server Components for data fetching, layouts, and static page rendering.
* Add `'use client'` only when browser interactivity requires it (e.g., the React Flow canvas, Liveblocks real-time hooks, and the AI chat sidebar).
* Use Server Actions for database mutations (like saving board state) instead of creating standard API routes (`app/api/...`), keeping server logic tightly coupled to the UI that invokes it.

## Styling

* Use Tailwind CSS utility classes exclusively; avoid creating custom `.css` or `.scss` files unless strictly necessary for React Flow overrides.
* Manage layering strictly; maintain a defined z-index hierarchy (e.g., Canvas = 0, Edges = 10, Nodes = 20, AI Sidebar = 40, Modals = 50).
* Avoid hardcoding magic values using Tailwind's arbitrary syntax (e.g., `w-[312px]`); if a value is reused, define it as a design token in `tailwind.config.ts`.

## Server Actions & API Routes

* Validate and parse all incoming request input (e.g., user prompts, board IDs) using Zod before any business logic runs.
* Enforce auth and ownership before any mutation; verify the active Clerk `userId` matches the `owner_id` of the board in Prisma before saving state.
* Offload long-running tasks; never await the Gemini API directly inside a Server Action to avoid Vercel timeouts. Immediately pass the payload to Trigger.dev and return a 202 Accepted status or Job ID to the client.

## Data and Storage

* Volatile, real-time collaboration state (cursor positions, active node dragging) belongs exclusively in Liveblocks in-memory storage.
* Persistent canvas state (nodes and edges) belongs in the PostgreSQL database stored as a single `JSONB` column, updated only on explicit save or periodic auto-saves.
* Metadata (User accounts, Board names, Timestamps) belongs in heavily indexed, standard relational PostgreSQL columns.
* Do not store canvas data in Vercel Blob or other object storage solutions; reserve those strictly for static file exports (if implemented later).

## File Organization

* `app/` — Next.js routing, page layouts, Server Actions, and primary API boundaries.
* `components/canvas/` — React Flow implementation, smart custom nodes (Compute, DB, etc.), custom edges, and the canvas property panels.
* `components/ai/` — Persistent sidebar UI, chat history state, and user prompt inputs.
* `lib/liveblocks/` — Multiplayer room configuration, WebSocket connection hooks, and synchronization logic.
* `trigger/` — Trigger.dev background task definitions and the Gemini 1.5 Flash API execution logic.
* `prisma/` — Database schema definitions, migrations, and the Prisma client instance.
</content>
