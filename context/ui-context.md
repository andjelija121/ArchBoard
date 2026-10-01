# UI Context

## Theme

Dark only. No light mode. The design language is a focused technical workspace — near-black backgrounds, subtly layered surfaces, and quiet chrome that recedes so the React Flow canvas and its color-coded infrastructure nodes read first. Chrome is intentionally low-chroma; saturated color is reserved for interactive states (accent) and node category identity on the canvas.

## Colors

All components must use these CSS custom property tokens — no hardcoded hex values in components. Tokens are defined once on `:root` in `app/globals.css`.

### Chrome (chosen intentionally muted)

| Role                 | CSS Variable         | Value     | Notes                                       |
| -------------------- | -------------------- | --------- | ------------------------------------------- |
| Page background      | `--bg-base`          | `#0a0a0b` | Near-black canvas backdrop                  |
| Surface (panels)     | `--bg-surface`       | `#131316` | Sidebars, chat panel, property panels       |
| Surface elevated    | `--bg-elevated`      | `#1c1c21` | Modals, popovers, hover states              |
| Primary text         | `--text-primary`     | `#f4f4f5` | Body and heading text                       |
| Muted text           | `--text-muted`       | `#a1a1aa` | Labels, secondary info, placeholders        |
| Subtle text          | `--text-subtle`      | `#71717a` | Timestamps, meta, disabled                  |
| Border default       | `--border-default`   | `#27272a` | Panel separators, node outlines             |
| Border strong        | `--border-strong`    | `#3f3f46` | Selected/focused element outlines           |
| Primary accent       | `--accent-primary`   | `#22d3ee` | Cyan — interactive/selected/active states   |
| Primary accent hover | `--accent-primary-hover` | `#67e8f9` | Hover state for accent elements         |
| Error                | `--state-error`      | `#f87171` | Failed AI generation, disconnect errors     |
| Success              | `--state-success`    | `#4ade80` | Save confirmation, sync healthy             |
| Warning              | `--state-warning`    | `#fbbf24` | Auto-save pending, guest joined             |

<!--
Alternative accents to try (swap `--accent-primary` and `--accent-primary-hover`):
- Emerald: #10b981 / #34d399 — "terminal/console" feel
- Amber:   #f59e0b / #fbbf24 — warm, distinctive (may clash with Load Balancer node)
Leaving cyan as the default; final choice pending visual review.
-->

### Node Category Palette (canvas-only)

These colors identify infrastructure types on the React Flow canvas. They must **only** be used on smart nodes (fills, icons, category badges) — never in chrome UI. Each hue is distinct on the color wheel for color-blind distinguishability.

| Category      | CSS Variable        | Value     | Role                          |
| ------------- | ------------------- | --------- | ----------------------------- |
| Client        | `--node-client`     | `#94a3b8` | Slate — end-user, recedes     |
| Load Balancer | `--node-lb`         | `#f59e0b` | Amber — traffic director      |
| Compute       | `--node-compute`    | `#10b981` | Green — live service          |
| Cache         | `--node-cache`      | `#ef4444` | Red — hot data                |
| Queue/Broker  | `--node-queue`      | `#a855f7` | Purple — async decoupling     |
| Database      | `--node-database`   | `#3b82f6` | Blue — persistent storage     |

Each node color additionally has a `-bg` variant at ~15% opacity for node fills (e.g., `--node-database-bg`) and is used at full opacity for borders, icons, and category badges.

### Bounding Box Palette (canvas-only)

Bounding boxes (Unit 10) use their own `--group-*` tokens so the `--node-*` palette stays reserved for smart nodes. Like the node palette, they are used only inside `components/canvas/`, never in chrome. Each has a `-bg` variant at ~8% opacity for the box fill.

| Key    | CSS Variable     | Value     |
| ------ | ---------------- | --------- |
| slate (default) | `--group-slate`  | `#94a3b8` |
| cyan   | `--group-cyan`   | `#22d3ee` |
| amber  | `--group-amber`  | `#f59e0b` |
| green  | `--group-green`  | `#10b981` |
| purple | `--group-purple` | `#a855f7` |

## Typography

Using [IBM Plex Sans](https://www.ibm.com/plex/) for UI (engineered/industrial character, distinct from the Geist ubiquity) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) for code, API routes, and edge protocol labels (superior character disambiguation for `0/O`, `1/l/I`).

| Role                        | Font            | Variable      |
| --------------------------- | --------------- | ------------- |
| UI text / headings          | IBM Plex Sans   | `--font-sans` |
| Code, API routes, protocols | JetBrains Mono  | `--font-mono` |

Load via `next/font/google` in `app/layout.tsx`. Replace the current Geist Sans / Geist Mono imports.

### Type Scale

| Role              | Class          | Size    |
| ----------------- | -------------- | ------- |
| Body              | `text-sm`      | 14px    |
| Small / labels    | `text-xs`      | 12px    |
| Node title        | `text-sm font-medium` | 14px |
| Edge label        | `text-xs font-mono`   | 12px |
| Panel heading     | `text-base font-semibold` | 16px |
| Page heading      | `text-xl font-semibold`   | 20px |

## Border Radius (soft-sharp scale)

Precise but not harsh — small radii to keep the schematic feel without hard corners.

| Context                            | Class        | Value |
| ---------------------------------- | ------------ | ----- |
| Inline / small UI (buttons, badges, edge labels) | `rounded-sm` | 2px   |
| Cards / panels / smart nodes       | `rounded-md` | 6px   |
| Modals / overlays / popovers       | `rounded-lg` | 8px   |

## Component Library

shadcn/ui on top of Tailwind CSS v4. Components live in `components/ui/` and are treated as generated primitives — do not edit directly (see `ai-workflow-rules.md`). Extend by composing wrappers in feature folders (`components/canvas/`, `components/ai/`).

## Layout Patterns

- **Editor view (board open):** full-viewport layout — top bar (board title, share button, save status) with bottom border, center React Flow canvas (`--bg-base`), right-anchored AI chat sidebar (`--bg-surface`) with left border separator. A shared property panel slides in from the right over the canvas when an edge, node or bounding box is selected (edges: protocol, sync/async, API route, load; nodes: label, sub-label; boxes: label, color, ungroup).
- **Sidebars:** fixed width (chat sidebar: 360px), full-height, single-border separator against canvas — no shadows.
- **Modals:** centered overlay on `--bg-elevated` with backdrop blur (`backdrop-blur-sm`) over a semi-transparent scrim; `rounded-lg`.
- **Top bar:** 48px height, `--bg-surface`, bottom border only — no shadow.
- **Property panels:** anchored right, `--bg-surface`, single left border, no elevation.

## Z-Index Hierarchy

Strict layering to prevent overlap conflicts between the canvas, edges, sidebar, and modals (see `code-standards.md` — Styling). Use these Tailwind classes exclusively:

| Layer          | Class    | Value |
| -------------- | -------- | ----- |
| Canvas base    | `z-0`    | 0     |
| Edges          | `z-10`   | 10    |
| Nodes          | `z-20`   | 20    |
| Node selection outline | `z-30` | 30 |
| AI chat sidebar / property panel | `z-40` | 40 |
| Modals / popovers / toasts | `z-50` | 50 |

## Icons

[Lucide React](https://lucide.dev). Stroke-based icons only, consistent 1.5px stroke.

| Context           | Size class    | Pixels |
| ----------------- | ------------- | ------ |
| Inline (with text) | `h-4 w-4`    | 16px   |
| Buttons           | `h-4 w-4`     | 16px   |
| Smart node category icons | `h-5 w-5` | 20px |
| Empty-state / hero | `h-8 w-8`    | 32px   |

Each node category should be paired with a fixed Lucide icon (e.g., Database → `Database`, Compute → `Server`, Cache → `Zap`, Queue → `ListOrdered`, Load Balancer → `Split`, Client → `Monitor`). Icon color always matches the node category color token.
