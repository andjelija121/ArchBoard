# ArchBoard

## Overview

ArchBoard is a real-time collaborative whiteboarding application designed for software engineers to practice system design interviews and map out distributed architectures. It solves the friction of manually drawing out complex systems under pressure by using an AI assistant to instantly scaffold infrastructure blocks onto the canvas based on text prompts. Users can seamlessly connect these components, define communication protocols (REST, WebSockets, etc.), document API routes, and invite peers via a frictionless share link to collaborate in real-time.

## Goals

1. Enable users to scaffold a baseline system architecture (5+ components) on a canvas via a single text prompt in under 10 seconds.
2. Support real-time, conflict-free collaboration for simultaneous users on a single board with zero login friction for guests.
3. Provide a structured, visually distinct set of infrastructure nodes (Compute, Database, Queue, Gateway, Client) and custom edges to document precise API routes and communication protocols.

## Core User Flow

1. User signs in via Clerk (GitHub/Google OAuth).
2. User creates a new project board and opens the React Flow canvas.
3. User opens the persistent AI chat sidebar and types a prompt (e.g., "Add an API Gateway, User Service, and Postgres DB").
4. Trigger.dev processes the request in the background, and the AI returns structured JSON.
5. The UI automatically spawns the requested blocks into predefined horizontal "swimlanes" (e.g., Gateways on the left, Databases on the right) without overlapping.
6. User clicks and drags to draw connection edges between the spawned blocks.
7. User clicks a connection edge to open a properties panel, defining the protocol (e.g., REST, WebSocket), sync/async behavior, and primary API routes/load estimations.
8. User clicks "Share", chooses a role (view or edit), and generates a revocable share link; they send it to a peer, who joins instantly as an anonymous guest (editor or read-only, per the link) to view or modify the board in real-time. The owner can revoke the link at any time.
9. The board owner clicks save (or auto-saves), storing the Liveblocks canvas state into a PostgreSQL `JSONB` column via Prisma.

## Features

### Canvas & Diagramming

* **Swimlane-based Spawning:** Nodes automatically spawn in predetermined X-coordinate columns based on category (Clients, Gateways, Services, Queues, Data Layer) to prevent clutter.
* **Smart Infrastructure Nodes:** Custom React Flow nodes with icons and specific property fields (Client, Compute, Database, Cache, Queue/Broker, Load Balancer).
* **Annotated Edges:** Custom React Flow edges with click-to-edit properties for communication protocols (REST, gRPC, WebSocket) and API route documentation.
* **Bounding Boxes:** Parent node grouping to visually group components together (e.g., wrapping 3 services in a "Microservices Cluster" box).

### AI Assistant

* **Persistent Chat Sidebar:** A dedicated UI panel for sending infrastructure generation prompts.
* **Asynchronous Processing:** Background job handling via Trigger.dev to prevent UI freezing or request timeouts during AI generation.
* **Strict JSON Generation:** Prompt engineering and structured outputs ensuring newly spawned blocks perfectly match the React Flow node schema.

### Collaboration & Data

* **Multiplayer Engine:** Liveblocks-powered real-time cursor tracking and component state synchronization.
* **Revocable Share Links:** Token-based sharing that grants instant guest access without requiring an account. Each link carries a role — view (read-only) or edit — and the owner can revoke it at any time. Access is via the share token, never the raw board id.
* **Persistent State Storage:** Saving of canvas JSON state in a PostgreSQL database using Prisma.

## Scope

### In Scope

* Next.js frontend with a React Flow canvas implementation.
* Clerk authentication for project creators/owners.
* PostgreSQL database (managed via Prisma ORM) for saving user metadata, board metadata, and canvas JSON state.
* Liveblocks integration for multiplayer web-socket synchronization.
* AI block generation (append-only) via Trigger.dev and Google Gemini.
* 6 core smart block types: Client, Compute, Database, Cache, Queue/Broker, Load Balancer.

### Out of Scope

* AI drawing connections (edges) between blocks.
* AI mutating, editing, or deleting existing blocks on the canvas.
* Complex math-based auto-layout engines (e.g., Elkjs, Dagre).
* Vercel Blob storage for canvas state (Postgres handles this directly).
* In-app video or audio chat capabilities.
* Exporting diagrams to static images (PNG/SVG).

## Success Criteria

1. A signed-in user can create a project board, open it, and the application successfully saves the empty state to the Postgres database.
2. A user can type a prompt in the sidebar and see valid, interactable React Flow nodes spawn in correct swimlane positions.
3. A user can draw an edge between two nodes and successfully assign text metadata (protocol, API route) to that edge via a side panel.
4. A guest user can open a shared board link in an incognito window and immediately see, move, and edit blocks in real-time sync with the board owner.
