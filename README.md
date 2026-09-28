# ArchBoard

A real-time collaborative whiteboarding tool for practicing system design interviews. Describe an architecture in plain text, watch an AI assistant scaffold it onto a canvas, then connect components, annotate protocols, and invite peers to edit alongside you in real time.

## What it does

- **AI-scaffolded diagrams** — type a prompt like "Add an API Gateway, User Service, and Postgres DB" and matching infrastructure nodes spawn on the canvas in the right swimlane, automatically.
- **Smart infrastructure nodes** — six node types (Client, Compute, Database, Cache, Queue/Broker, Load Balancer), each with its own fields and canvas color.
- **Annotated connections** — draw edges between nodes and document the protocol (REST, gRPC, WebSocket), sync/async behavior, and API routes.
- **Real-time collaboration** — share a board link and a guest joins instantly as an editor, no account required.

See [context/project-overview.md](context/project-overview.md) for the full product spec.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript |
| UI & Canvas | Tailwind CSS + shadcn/ui + React Flow |
| Auth | Clerk |
| Database | PostgreSQL + Prisma |
| Multiplayer | Liveblocks |
| Background tasks | Trigger.dev |
| AI engine | Structured-output generation for infrastructure nodes |

Full architectural detail, storage model, and system invariants live in [context/architecture.md](context/architecture.md).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project context

This project is built using a spec-driven workflow: a set of context files define the product, architecture, UI conventions, code standards, and current progress before any implementation happens. Read them in order before making changes:

1. [context/project-overview.md](context/project-overview.md) — product definition, goals, features, and scope
2. [context/architecture.md](context/architecture.md) — system structure, boundaries, storage model, and invariants
3. [context/ui-context.md](context/ui-context.md) — theme, colors, typography, and component conventions
4. [context/code-standards.md](context/code-standards.md) — implementation rules and conventions
5. [context/ai-workflow-rules.md](context/ai-workflow-rules.md) — development workflow, scoping rules, and delivery approach
6. [context/progress-tracker.md](context/progress-tracker.md) — current phase, completed work, open questions, and next steps

`CLAUDE.md` points any AI coding agent working in this repo at these files automatically.

## Project structure

```
app/               Next.js routing, layouts, pages, Server Actions
components/ui/     Generated shadcn/ui primitives (do not hand-edit)
components/canvas/ React Flow canvas, smart nodes, edges, property panels
components/ai/     AI chat sidebar
lib/liveblocks/    Multiplayer room config and sync hooks
trigger/           Background AI generation jobs
prisma/            Database schema and migrations
context/           Project spec, architecture, and workflow docs (see above)
```

## Deploy

The easiest way to deploy is via the [Vercel Platform](https://vercel.com/new). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
</content>
