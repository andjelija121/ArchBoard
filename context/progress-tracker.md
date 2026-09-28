# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Editor chrome — base navbar/sidebar/dialog shell built. Base app scaffold (auth/DB/canvas) not started yet.

## Current Goal

- Scaffold the base project: Clerk auth, Prisma schema (User, Board models), and the initial board creation flow (create board → empty React Flow canvas → save empty state to Postgres).

## Completed

- Editor chrome shell (`context/feature-specs/02-editor.md`):
  - `components/editor/editor-navbar.tsx` — 48px (`h-12`) fixed-height navbar, `bg-card`/`border-b border-border` (maps to `--bg-surface`/`--border-default`), three-section (left/center/right) flex layout. Left section holds a sidebar-toggle `Button` swapping `PanelLeftOpen`/`PanelLeftClose` off an `isSidebarOpen` prop; toggle handled via `onToggleSidebar` callback (state lives in the parent page, not the navbar). Center and right sections are empty placeholders for now.
  - `components/editor/project-sidebar.tsx` — floating panel (`fixed inset-y-0 left-0 z-40`, matching the AI-sidebar/property-panel z-layer since no dedicated layer is specified for it), `w-80`, slides in from the left via `-translate-x-full` → `translate-x-0` transition, `border-r` facing the canvas (doesn't push page content, since it's `fixed`) — flipped from an initial right-side placement per user request. Header with "Projects" title + close button (`X` icon). Body is a shadcn `Tabs` (`My Projects` / `Shared`), both with empty-placeholder text. Footer has a full-width `New Project` `Button` with a `Plus` icon.
  - `components/editor/dialog-pattern.tsx` — generic wrapper over `components/ui/dialog.tsx` (title, optional description, optional footer, optional children body). Styling comes entirely from `DialogContent`'s existing `bg-popover`/`text-popover-foreground` tokens (→ `--bg-elevated`/`--text-primary`), so no new colors were added. No concrete dialog instance built on top of it yet, per spec.
  - Both `editor-navbar.tsx` and `project-sidebar.tsx` are controlled components (`isSidebarOpen`/`isOpen` + callbacks).
  - `components/editor/editor-shell.tsx` — client component that owns the `isSidebarOpen` state and wires `EditorNavbar` + `ProjectSidebar` together, rendering a `children` slot (`flex-1 overflow-hidden bg-background`) in between for the future canvas. This is the "base chrome" the spec says every editor screen reuses.
  - `app/editor/page.tsx` — first concrete usage: mounts `EditorShell` with a placeholder "Canvas not built yet." message in the children slot, so the toggle/slide behavior is reachable at `/editor`. No auth/board-loading logic — that's still gated on the Clerk/Prisma scaffold.
  - Verified: `npm run build` (clean `.next`) and `npm run lint` both pass with zero errors; `/editor` route builds statically.

- Cursor affordance: added `cursor-pointer` to `buttonVariants` in `components/ui/button.tsx` and to `TabsTrigger` in `components/ui/tabs.tsx`. Tailwind's preflight resets `button` to `cursor: default` and shadcn doesn't override it, so this wasn't automatic — done on explicit user request despite these being protected/generated primitives (see `ai-workflow-rules.md`).

- Typography swap (closes the font open question below): `app/layout.tsx` now loads `IBM_Plex_Sans` (`--font-sans`) and `JetBrains_Mono` (`--font-mono`) via `next/font/google` instead of Geist Sans/Mono, per `context/ui-context.md`. Also added `--font-mono: var(--font-mono);` to the `@theme inline` block in `app/globals.css` so the `font-mono` Tailwind utility actually resolves to JetBrains Mono (previously unmapped). In the process, found `--font-sans: var(--font-sans);` in that same block was self-referential and never resolved under Geist (which set `--font-geist-sans`, not `--font-sans`) — the whole app had silently been rendering in the browser's default font, not even Geist, since `01-design-system.md` was done. Naming the `next/font` variables `--font-sans` / `--font-mono` directly fixes this.

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

- `--radius` and the node-category canvas palette (`--node-*`) from `ui-context.md` were not added — no canvas components exist yet to consume them; add when `components/canvas/` is scaffolded.
- `02-editor.md` didn't specify who owns the open/closed state shared by `editor-navbar.tsx` and `project-sidebar.tsx`, or a fixed width for the project sidebar. Made both components controlled (parent passes `isSidebarOpen`/`isOpen` + toggle callbacks) and picked `w-80` (320px, standard Tailwind scale) for the sidebar width, distinct from the 360px AI chat sidebar `ui-context.md` defines elsewhere. Neither is wired into a page yet — no editor page/layout exists to mount them.
- `02-editor.md` didn't assign a z-index layer to the project sidebar specifically; reused `z-40` (the "AI chat sidebar / property panel" layer from `ui-context.md`'s hierarchy) since it's the closest matching floating-panel-over-canvas layer.

## Architecture Decisions

- shadcn/ui installed via the `shadcn` CLI v4 (`radix-nova` preset) rather than the classic v2 CLI, since that's what `npx shadcn@latest` currently resolves to. Uses Radix primitives (`radix-ui` package) and the official `cn` npm package instead of a hand-rolled `clsx` + `tailwind-merge` util — functionally equivalent to the classic setup.
- Dark mode is forced via a static `dark` class on `<html>` rather than a `next-themes` provider, since the product has no light mode or theme toggle (per `ui-context.md`).

## Session Notes

- `components/ui/*` are generated primitives — do not hand-edit them (see `ai-workflow-rules.md` protected files); extend via wrapper components in `components/canvas/` or `components/ai/` when those features are built.
