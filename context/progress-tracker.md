# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Design system — UI primitives installed, dark theme wired up. Base app scaffold (auth/DB/canvas) not started yet.

## Current Goal

- Scaffold the base project: Clerk auth, Prisma schema (User, Board models), and the initial board creation flow (create board → empty React Flow canvas → save empty state to Postgres).

## Completed

- Design system & UI primitives (`context/feature-specs/01-design-system.md`):
  - Installed shadcn/ui (`components.json`, style `radix-nova`, base color `neutral`, CSS variables on).
  - Added components: `button`, `card`, `dialog`, `input`, `tabs`, `textarea`, `scroll-area` in `components/ui/`.
  - Added `cn()` in `lib/utils.ts` (re-exports the `cn` package, shadcn's official clsx + tailwind-merge replacement).
  - Installed `lucide-react`.
  - Rewrote `app/globals.css` tokens to match `context/ui-context.md`'s dark chrome palette (`--bg-base`, `--bg-surface`, `--bg-elevated`, `--text-*`, `--border-*`, `--accent-primary`, `--state-*`) and mapped shadcn's semantic vars (`--background`, `--card`, `--primary`, etc.) onto them, for both `:root` and `.dark` (no light-mode block remains).
  - Forced dark mode by adding the `dark` class to `<html>` in `app/layout.tsx` (app is dark-only, no theme toggle).
  - Verified: `npm run build` passes with zero TypeScript errors; a temporary smoke-test route imported and rendered all 7 components plus `cn()` and a `lucide-react` icon successfully, then was removed.

## In Progress

- None yet.

## Next Up

- Scaffold base project: Clerk auth, Prisma schema (User, Board), initial board creation flow.

## Open Questions

- `context/ui-context.md` specifies IBM Plex Sans / JetBrains Mono fonts replacing Geist, but `01-design-system.md`'s checklist didn't call out fonts, so `app/layout.tsx` still loads Geist Sans/Mono. Font swap left for a dedicated unit (touches `layout.tsx` typography, not "design system primitives" scope).
- `--radius` and the node-category canvas palette (`--node-*`) from `ui-context.md` were not added — no canvas components exist yet to consume them; add when `components/canvas/` is scaffolded.

## Architecture Decisions

- shadcn/ui installed via the `shadcn` CLI v4 (`radix-nova` preset) rather than the classic v2 CLI, since that's what `npx shadcn@latest` currently resolves to. Uses Radix primitives (`radix-ui` package) and the official `cn` npm package instead of a hand-rolled `clsx` + `tailwind-merge` util — functionally equivalent to the classic setup.
- Dark mode is forced via a static `dark` class on `<html>` rather than a `next-themes` provider, since the product has no light mode or theme toggle (per `ui-context.md`).

## Session Notes

- `components/ui/*` are generated primitives — do not hand-edit them (see `ai-workflow-rules.md` protected files); extend via wrapper components in `components/canvas/` or `components/ai/` when those features are built.
