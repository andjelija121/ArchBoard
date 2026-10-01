# Unit 11: AI Chat Sidebar UI (no backend)

## Goal

Build the persistent right-hand AI chat sidebar in `components/ai/`:
a prompt composer, a scrollable chat history, and the pending /
success / error visual states for a generation turn — wired to a
**stubbed submit (no network)**. Typing a prompt and sending it adds the
prompt to the history and shows a pending "generating" indicator that
resolves to a placeholder reply. No Trigger.dev, Gemini, Server Action,
or node spawning is built here — those are Unit 12.

> **Scope note.** The build plan (`00-build-plan.md` → Unit 11) splits
> the sidebar UI from the AI backend per `ai-workflow-rules.md` ("do not
> combine UI rendering changes with background-task / Trigger.dev
> execution logic in a single step"). This unit owns only
> `components/ai/` plus the minimal wiring in `board-editor.tsx` needed
> to mount the sidebar beside the canvas. The stub `submit` is written
> as a clean seam so Unit 12 replaces only its internals, not the
> sidebar's shape or state model.

## Design

Follows `ui-context.md`. The sidebar is **chrome**, so it uses only
chrome tokens — the `--node-*` / `--group-*` palettes never appear in it
(those are canvas-only). Saturated color is reserved for the accent
(`--accent-primary`) on interactive/active states and for the two state
tokens (`--state-error`, `--state-success`) on generation status.

### Layout & placement (`ui-context.md` → *Layout Patterns*)

The *Editor view* description: "right-anchored AI chat sidebar
(`--bg-surface`) with left border separator… fixed width (chat sidebar:
360px), full-height, single-border separator against canvas — no
shadows." So:

- **Desktop (`lg` and up):** the sidebar is **docked** — a flex sibling
  of the canvas area that shrinks the canvas, not a panel floating over
  it. Full height of the canvas region (it lives inside the editor
  children area, below the 48px navbar), `border-l border-border`
  (= `--border-default`) against the canvas, `bg-card` (= `--bg-surface`),
  **no shadow**.
- **Width:** `w-90` → `90 × 0.25rem = 22.5rem = 360px`, the exact chat
  width in `ui-context.md`. This is a standard Tailwind v4 dynamic
  spacing value (same family as the project sidebar's `w-80`), **not**
  arbitrary `w-[360px]` bracket syntax — so `code-standards.md` →
  *Styling* ("avoid hardcoding magic values with arbitrary syntax") is
  satisfied without adding a `tailwind.config.ts` token.
- **Mobile (below `lg`):** 360px docked would crush the canvas, so the
  sidebar instead **overlays** the canvas from the right — `absolute
  inset-y-0 right-0 z-40 w-full max-w-90`, sliding in with
  `translate-x-full → translate-x-0` and `transition-transform
  duration-200 ease-in-out` (mirrors `project-sidebar.tsx:49`). A
  mobile backdrop scrim (`fixed inset-0 z-30 bg-black/50 … lg:hidden`,
  tap-to-close) matches the project sidebar's scrim pattern.
- **Layer:** `z-40` — the "AI chat sidebar / property panel" layer in
  `ui-context.md` → *Z-Index Hierarchy*. Above the add-node toolbar
  (`z-30`) and canvas (`z-0`); below modals/popovers (`z-50`).
- **Collapse:** the sidebar is **collapsible**. Default **open** on
  desktop, **closed** on mobile. A navbar toggle controls it (see
  *Implementation §5*). When docked and closed, the flex child collapses
  to zero width so the canvas reclaims the full area; when overlay and
  closed, it is translated off-screen.

### Coexistence with the property panel (Unit 09)

The Unit 09 `PropertyPanel` is `absolute inset-y-0 right-0 z-40` and
floats **over the canvas**. The AI sidebar is docked **beside** the
canvas. Keeping the property panel inside the canvas-area wrapper (the
`flex-1` child) and the AI sidebar as the next flex sibling means the
property panel anchors to the **right edge of the canvas area** — i.e.
immediately left of the docked sidebar — so the two never overlap on
desktop. On mobile both are right-anchored overlays at `z-40`; they are
not expected to be open simultaneously (selecting an element and chatting
are distinct actions), and if both are, the later-mounted one wins
visually — acceptable for this unit.

### Header

- 48px (`h-12`) row, `border-b border-border`, `shrink-0`, `px-3`,
  matching the project sidebar header (`project-sidebar.tsx:53`) and the
  navbar height so the sidebar top aligns with the canvas top.
- Left: a `Sparkles` Lucide icon (`h-4 w-4`, 1.5 stroke, `text-primary`
  = accent) + title **"AI Assistant"** (`text-base font-semibold
  text-foreground` — the *Panel heading* scale).
- Right: a ghost `Button size="icon-sm"` with the `PanelRightClose`
  icon (same vocabulary as `help-dialog.tsx` / the navbar toggle),
  `aria-label="Close AI assistant"`, that collapses the sidebar.

### Chat history (message list)

- A `ScrollArea` (shadcn, already present) filling the space between
  header and composer, `p-3`, `flex flex-col gap-3`. New messages
  auto-scroll to the bottom.
- **Empty state** (no messages): centered hero — `Sparkles` `h-8 w-8`
  (`ui-context.md` → *Icons* → empty-state size) in `text-muted-foreground`,
  a `text-sm text-foreground` line ("Describe your system and I'll
  scaffold it."), and 2–3 example prompt chips (`text-xs`, `rounded-sm
  border border-border px-2 py-1 text-muted-foreground`) such as
  "Add an API Gateway, a User service, and a Postgres DB". Clicking a
  chip fills the composer with that text (it does **not** auto-send) so
  the user can edit before sending.
- **User message** (`role: "user"`): right-aligned bubble, `ml-auto
  max-w-[85%]`, `bg-muted` (= `--bg-elevated`, stands off the
  `--bg-surface` panel), `rounded-md` (6px, *cards* radius), `px-3 py-2`,
  `text-sm text-foreground`, `whitespace-pre-wrap break-words`. A
  `text-xs text-text-subtle` timestamp below, right-aligned.
- **Assistant message** (`role: "assistant"`): left-aligned, full width,
  no bubble fill (reads as system output on the panel surface). A small
  leading `Sparkles` `h-4 w-4 text-primary`, then status-dependent
  content (below). `text-sm`.

### Generation status (the three required states)

The assistant message carries a `status`. Its appearance:

- **`pending`** — a `Loader2` `h-4 w-4 animate-spin text-muted-foreground`
  + "Generating…" in `text-sm text-muted-foreground`. (Reuses the
  spinner idiom from the save status in `board-editor.tsx:83`.)
- **`success`** — the reply text in `text-sm text-foreground`. In this
  unit the reply is a fixed placeholder (see stub below); Unit 12
  replaces it with a real summary of spawned nodes.
- **`error`** — an `AlertCircle` `h-4 w-4 text-state-error` + the error
  text in `text-sm text-state-error`, and a small `Retry` ghost `Button`
  (`size="sm"`) that re-submits the original prompt. The stub never
  produces this state on its own; it is rendered purely from
  `status === "error"` so Unit 12 / Unit 16 can drive it without
  touching the view. (Honest note: to eyeball the error style during
  this unit, temporarily seed a message with `status: "error"`; remove
  before committing.)

### Composer (prompt input)

- Pinned to the bottom, `shrink-0 border-t border-border p-3`.
- A shadcn `Textarea` (already present), `font-sans` (prompts are natural
  language, not code), `min-h` ~2 rows, auto-growing up to a cap
  (e.g. `max-h-40`) then scrolling, placeholder "Describe infrastructure
  to add…", `text-sm`. `aria-label="AI prompt"`.
- **Enter submits; Shift+Enter inserts a newline.** While a generation
  is in flight (`isSending`), the textarea stays editable but the send
  action is disabled.
- A send `Button` (`size="icon-sm"`, accent/default variant) with the
  `ArrowUp` icon, bottom-right of the composer, `aria-label="Send
  prompt"`. **Disabled** when the trimmed input is empty **or**
  `isSending` is true. A small `text-xs text-text-subtle` hint under the
  composer: "Enter to send · Shift+Enter for a new line".

## Implementation

All files are new under `components/ai/` (the boundary this unit owns,
per `architecture.md` → *System Boundaries* and `code-standards.md` →
*File Organization*: "`components/ai/` — persistent sidebar UI, chat
history state, and user prompt inputs"). Each interactive file is
`"use client"`.

### 1. `components/ai/ai-types.ts` — shared types + id helper

```ts
export type ChatRole = "user" | "assistant"
export type GenerationStatus = "pending" | "success" | "error"

export interface ChatMessage {
  id: string
  role: ChatRole
  /** User prompt text, or the assistant reply/status text. */
  content: string
  /** Only meaningful for assistant messages; user messages are "success". */
  status: GenerationStatus
  /** The user prompt this assistant turn answers — used by Retry. */
  prompt?: string
  createdAt: number
}

export function createMessageId(): string {
  return `m_${crypto.randomUUID()}`
}
```

Rationale: a flat message list (user + assistant interleaved) keyed by
`id`, mirroring the id-helper convention already in `lib/canvas.ts`
(`createEdgeId` → `e_…`, `createNodeId` → `n_…`; here `m_…`). The type
lives in `components/ai/`, not `lib/canvas.ts`, because it is chat state,
not canvas state — keeping the boundaries clean (`code-standards.md` →
*General*: "keep modules small and single-purpose").

### 2. `components/ai/use-ai-sidebar.ts` — state hook (owns the seam)

A dedicated hook, mirroring `use-project-dialogs.ts`. It owns the open
state, the input draft, the message list, and the **stub submit**.

```ts
export interface UseAiSidebar {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void

  input: string
  setInput: (value: string) => void

  messages: ChatMessage[]
  isSending: boolean
  submit: (prompt?: string) => void   // defaults to current input
  retry: (prompt: string) => void
}
```

- `isOpen` initial value: open on desktop, closed on mobile. Resolve
  once on mount from a `matchMedia("(min-width: 1024px)")` check inside
  a `useEffect` (SSR-safe: start `false`, set `true` on mount if the
  media query matches) so hydration is stable and the `lg` breakpoint
  matches the Tailwind `lg` used in the view.
- **`submit(prompt?)`** (the stub, replaced wholesale in Unit 12):
  1. `const text = (prompt ?? input).trim()`; return early if empty or
     `isSending`.
  2. Append a user message (`role: "user"`, `status: "success"`,
     `content: text`).
  3. Append an assistant message (`role: "assistant"`,
     `status: "pending"`, `content: ""`, `prompt: text`); remember its
     id.
  4. `setInput("")`; set `isSending` true.
  5. `setTimeout(~1200ms)` → patch that assistant message to
     `status: "success"`, `content:` a fixed placeholder
     (**"Connected in Unit 12 — this is where generated nodes will be
     summarized."**); set `isSending` false.
  6. Store the timeout id in a ref and clear it on unmount so a resolve
     never fires after the component is gone (avoids a React
     state-update-after-unmount warning → "no console errors").
- **`retry(prompt)`** simply calls `submit(prompt)` again (the error
  message stays in history above the new turn).
- **Seam contract for Unit 12:** only the body of `submit` changes — it
  will call the new Server Action (prompt → Trigger.dev job id), keep
  the assistant message `pending` while polling the job, then flip it to
  `success` (and spawn nodes via the Unit 08 helper) or `error`. The
  hook's public shape, the message model, and every `components/ai/`
  view component stay exactly as built here.

### 3. `components/ai/chat-message.tsx` — one message row

`React.memo` presentational component. Props: `{ message: ChatMessage;
onRetry: (prompt: string) => void }`. Branches on `message.role`, and
for assistants on `message.status`, rendering exactly the markup in
*Design → Chat history / Generation status*. No state of its own.

### 4. `components/ai/ai-empty-state.tsx` — empty history hero

Props: `{ onPickExample: (text: string) => void }`. Renders the hero
icon, the line, and the example chips (each a button calling
`onPickExample` with its text). Example prompts are a module-level
`const EXAMPLE_PROMPTS: string[]`.

### 5. `components/ai/ai-sidebar.tsx` — the panel shell

`"use client"`. Props are presentational — it owns no state; everything
comes from the hook via the parent:

```ts
interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
  input: string
  onInputChange: (value: string) => void
  messages: ChatMessage[]
  isSending: boolean
  onSubmit: () => void
  onRetry: (prompt: string) => void
}
```

Structure:

- Root `aside`, `inert={!isOpen}` (so collapsed content is not tab-
  reachable, matching `project-sidebar.tsx:47`), with the responsive
  classes from *Design → Layout*:
  - Shared: `flex h-full flex-col border-l border-border bg-card`.
  - Overlay-on-mobile: `absolute inset-y-0 right-0 z-40 w-full max-w-90
    transition-transform duration-200 ease-in-out` +
    (`isOpen ? "translate-x-0" : "translate-x-full"`).
  - Docked-on-desktop: `lg:static lg:z-auto lg:max-w-none lg:translate-x-0`
    and the **width is driven by the parent flex item** (see §6) so the
    canvas reclaims space when closed. (The `aside` itself stays
    `lg:w-full`, filling the width its flex wrapper gives it.)
- Header (§Design → Header). The close button calls `onClose`.
- `ScrollArea` body: `AiEmptyState` when `messages.length === 0`, else
  the mapped `ChatMessage` list. Keep a ref to a bottom sentinel and
  `scrollIntoView({ block: "end" })` in a `useEffect` on
  `messages.length` / last message status change.
- Composer (§Design → Composer): controlled `Textarea` bound to
  `input`/`onInputChange`; `onKeyDown` — Enter (no Shift) →
  `event.preventDefault()` + `onSubmit()`; send `Button` disabled on
  `!input.trim() || isSending`.
- Include the mobile backdrop scrim as a sibling before the `aside`
  (same pattern as `project-sidebar.tsx:37`), tapping it calls
  `onClose`.

### 6. `components/canvas/board-editor.tsx` — mount beside the canvas

Minimal wiring (this is the only file outside `components/ai/` that
changes):

- Call `const ai = useAiSidebar()` inside `BoardEditorInner`.
- **Navbar toggle:** add one ghost `Button size="icon-sm"` to the
  existing `navbarActions` fragment (place it first, before
  `<HelpButton />`): `Sparkles` icon, `aria-label="Toggle AI assistant"`,
  `aria-pressed={ai.isOpen}`, `onClick={ai.toggle}`. This keeps the AI
  toggle on the right side of the navbar (where the sidebar lives),
  symmetric with the project-sidebar toggle on the left.
- **Children layout:** wrap the current canvas-area markup and the new
  sidebar in a flex row so the sidebar docks and shrinks the canvas:

  ```tsx
  {() => (
    <div className="flex h-full w-full">
      <div className="relative flex-1 overflow-hidden">
        <BoardCanvas … />
        <AddNodeToolbar … />
        {panelSelection && <PropertyPanel … />}
      </div>
      <div
        className={cn(
          "h-full shrink-0 transition-[width] duration-200 ease-in-out",
          ai.isOpen ? "lg:w-90" : "lg:w-0 lg:overflow-hidden"
        )}
      >
        <AiSidebar
          isOpen={ai.isOpen}
          onClose={ai.close}
          input={ai.input}
          onInputChange={ai.setInput}
          messages={ai.messages}
          isSending={ai.isSending}
          onSubmit={ai.submit}
          onRetry={ai.retry}
        />
      </div>
    </div>
  )}
  ```

  - The existing canvas markup moves **unchanged** into the `flex-1`
    child; the `PropertyPanel` therefore now anchors to the right edge
    of the canvas area (immediately left of the docked sidebar), with no
    other change to Unit 09 behavior.
  - The outer wrapper of the sidebar is the flex item whose width
    animates on desktop (`lg:w-90` ↔ `lg:w-0`). On mobile the inner
    `aside` is `absolute`/overlay, so this wrapper's width is irrelevant
    there (the overlay sits above the canvas regardless).
- No change to the save lifecycle, selection logic, or any Server
  Action. The AI sidebar holds its own state and, in this unit, touches
  nothing on the canvas.

### 7. No server / schema / Prisma / dependency changes

This is a pure UI unit. No Server Action, no `lib/canvas.ts` change, no
Prisma model or migration, no new npm package (see *Dependencies*). The
canvas snapshot and `saveCanvas` are untouched; chat history is local
component state and is **not** persisted (it resets on reload — matching
"stubbed, no backend"; persistence of chat is not in scope for any unit
in `00-build-plan.md`).

## Dependencies

- **No new npm packages.** Everything is already installed:
  - `lucide-react` (Unit 01) — `Sparkles`, `ArrowUp`, `Loader2`,
    `AlertCircle`, `PanelRightClose`.
  - shadcn `Button`, `Textarea`, `ScrollArea` (Unit 01) — composer and
    history. No new shadcn primitive is added.
  - `cn` (Unit 01) — class composition.
  - React 19 (`useState`, `useEffect`, `useRef`, `useCallback`) — hook
    state and the stub timer.

## Verify when done

- [ ] On desktop the AI sidebar is docked at the right, 360px wide,
      `--bg-surface` with a single left border and **no shadow**, full
      height of the canvas area, top-aligned with the canvas (below the
      navbar); the canvas occupies the remaining width.
- [ ] The navbar `Sparkles` toggle collapses and reopens the sidebar;
      collapsing it on desktop gives the width back to the canvas
      (canvas re-fits), and `aria-pressed` reflects the open state.
- [ ] The empty state shows the hero + example prompt chips; clicking a
      chip fills the composer (does not auto-send) and the text is
      editable before sending.
- [ ] Typing a prompt and pressing **Enter** (or clicking send) adds the
      prompt as a right-aligned user message and shows a left-aligned
      assistant **pending** row ("Generating…", spinner); the composer
      clears. **Shift+Enter** inserts a newline instead of sending.
- [ ] The send button is disabled when the input is empty or trimmed-
      empty, and while a generation is pending.
- [ ] The pending row resolves to a **success** placeholder reply after
      the simulated delay; the history auto-scrolls to the newest
      message.
- [ ] The **error** state renders correctly when a message has
      `status: "error"` (error icon + `--state-error` text + Retry
      button), and Retry re-submits the original prompt. (Verified by
      temporarily seeding an error message; removed before commit.)
- [ ] On a mobile-width viewport the sidebar overlays the canvas from the
      right with a backdrop scrim (tap to close) instead of squeezing
      the canvas; it defaults closed and opens from the navbar toggle.
- [ ] The sidebar and all its contents use only chrome tokens — no
      `--node-*` / `--group-*` palette color appears; the accent
      (`--accent-primary`) is used only for the header icon, the active
      send button, and focus rings; `--state-error` / `--state-success`
      only on generation status.
- [ ] The sidebar sits at `z-40`: above the add-node toolbar (`z-30`)
      and canvas (`z-0`), below dialogs (`z-50`); the Unit 09 property
      panel still opens and anchors to the right edge of the canvas area
      (immediately left of the docked sidebar) without overlapping it on
      desktop.
- [ ] The Unit 07–10 flows are unaffected: pan/zoom, add node, connect,
      edit edge/node/group in the property panel, Save/reload all still
      work with the sidebar present.
- [ ] Collapsed sidebar content is not tab-reachable (`inert`), and no
      state-update-after-unmount warning fires if the board unmounts mid-
      generation (timer cleared on unmount).
- [ ] No TypeScript errors (message model and hook typed; no `any`).
- [ ] No console errors.
- [ ] Responsive at mobile and desktop (overlay vs docked as above; the
      composer and messages never cause horizontal overflow; long user
      prompts wrap, long single tokens break).
- [ ] `npm run build` passes.
