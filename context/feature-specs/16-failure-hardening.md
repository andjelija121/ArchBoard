# Unit 16: Guest Disconnect / AI Failure Fallback Hardening

## Goal

Make the two external-failure paths named in `code-standards.md` degrade
gracefully instead of crashing or silently stalling: **AI generation
failure** (Groq / Trigger.dev error, timeout, or worker-down) and
**Liveblocks disconnect / reconnect**, plus honest surfacing of
**save failures**. One consolidated hardening pass rather than error
handling sprinkled across earlier units.

## Design

Small, mostly-reactive UI. No new tokens; use the existing state tokens
(`--state-error`, `--state-warning`, `--state-success`) and the established
`RoomMessage` / `SaveStatus` visual language. Nothing new is "built" that a
user seeks out — the visible result is what appears **when things break**:

- A **connection banner** across the top of the canvas when Liveblocks is
  reconnecting or lost, instead of a frozen or crashing board.
- Clear, retryable **AI error states** in the sidebar for every failure
  mode (most already exist from Unit 12 — this unit audits and fills gaps).
- The **save-failed** status with its message (already wired in Unit 7/15 —
  audited here for completeness).

### Connection banner

A thin, non-blocking bar pinned to the top of the canvas area (`z-40`, below
modals), driven by Liveblocks' connection status:

- `connecting` / `reconnecting`: `--state-warning` bar, `Loader2`
  spinner + "Reconnecting…". The canvas stays visible and interactive
  (Liveblocks queues local mutations and replays them on reconnect).
- `disconnected` (giving up): `--state-error` bar, `AlertCircle` +
  "Connection lost. Your recent changes may not be saved." with a
  **Reload** button.
- `connected`: no banner. On a transition back to `connected` after a drop,
  optionally flash a brief `--state-success` "Reconnected" that
  auto-dismisses (~2s). Keep it subtle.

This replaces the all-or-nothing `RoomErrorBoundary` fallback for the
*transient* case: the boundary still catches a hard failure to ever
connect; the banner handles drops *after* a successful join.

## Implementation

### 1. Connection status hook — `lib/liveblocks/use-connection-status.ts` (new, `"use client"`)

Wrap the already-exported `useStatus` (from `liveblocks.config.ts`) into a
small hook that maps Liveblocks' status to the three banner states and
tracks the "just reconnected" flash:

```ts
type ConnectionBanner =
  | { kind: "ok" }
  | { kind: "reconnecting" }
  | { kind: "lost" }
  | { kind: "reconnected" }  // transient, auto-clears

export function useConnectionStatus(): ConnectionBanner
```

Liveblocks `useStatus` returns `"initial" | "connecting" | "connected" |
"reconnecting" | "disconnected"`. Map: `connecting`/`reconnecting` →
`reconnecting`; `disconnected` → `lost`; `connected` → `ok`, but if the
previous non-ok state was `reconnecting`/`lost`, emit `reconnected` for ~2s
first (timer, cleared on unmount). `initial` → `ok` (the Suspense fallback
in `LiveRoom` already covers first connect).

### 2. Connection banner component — `components/canvas/connection-banner.tsx` (new)

Presentational; takes the `ConnectionBanner` value and renders the bar per
§Design (or `null` for `ok`). Pinned `absolute top-0 inset-x-0 z-40`,
`pointer-events-none` except for the Reload button in the `lost` state.
`role="status"` for reconnecting, `role="alert"` for lost. Icons at
`h-4 w-4`, `strokeWidth={1.5}`.

Mount it inside the canvas `flex-1` wrapper in `board-editor.tsx` (both
owner and guest modes — a guest's connection can drop too), driven by
`useConnectionStatus()`.

### 3. AI failure audit — `components/ai/` (mostly already done in Unit 12)

Unit 12 already routes every terminal run state through `settleRun` with a
friendly message and keeps Retry unblocked. This unit **audits and fills
gaps**, changing code only where a path is missing:

- Confirm each failure renders the error bubble + **Retry** (Unit 11's
  `chat-message.tsx` error branch): enqueue failure, EXPIRED (worker down),
  TIMED_OUT, FAILED/CRASHED, subscription error, invalid/zod-rejected
  output, and an explicit refusal (`{ ok: false, error }`).
- Confirm Retry always re-enables the composer (`isSending` cleared on
  every terminal/error path) — the Unit 12 entry notes this; verify no
  regression.
- **Gap to close if present:** a run that never terminates and never errors
  (e.g. SSE silently stalls). Add a client-side watchdog — if a pending run
  has had no status update for N seconds (e.g. 100s, just past the 90s TTL),
  settle it as an error ("Generation stalled. Please retry."). Only add
  this if Unit 12 doesn't already effectively cover it via the TTL→EXPIRED
  path; prefer not to duplicate.
- No backend change. The AI remains append-only; a failed generation
  spawns nothing (already the case — spawn happens only on validated
  `COMPLETED` output).

### 4. Save failure surfacing — audit only

Units 7 and 15 already set `status: "error"` + message on a `saveCanvas`
failure, shown by `SaveStatus` (with the message in its `title`). This unit
confirms:

- An autosave failure is as visible as a manual-save failure (same status
  machine — it is, post-Unit-15).
- After an error, both the debounce and the manual Save can retry (Unit 15's
  `saveNow` stays enabled on `error`).
- No silent swallow: every `saveCanvas` rejection logs server-side and
  returns a generic client message (already the case).

If all three hold, §4 is a no-op beyond a documented verification.

### 5. Hard-failure boundary stays

`RoomErrorBoundary` in `room-provider.tsx` is unchanged for the case where
the room never connects (bad token, auth 500, Liveblocks unreachable). The
banner (§2) handles drops *after* a join; the boundary handles *never
joining*. Make sure the two don't double-render (the banner only shows once
Storage has loaded, i.e. inside `ClientSideSuspense`).

## Dependencies

- None new. Uses the already-exported `useStatus` Liveblocks hook, the
  existing Trigger.dev realtime hooks, and existing state tokens.

## Verify when done

- [ ] Kill the network with the board open → a "Reconnecting…" warning
      banner appears and the canvas does not crash or freeze-crash
- [ ] Restore the network → Liveblocks reconnects, queued local edits
      replay, and the banner clears (optionally flashing "Reconnected")
- [ ] A prolonged disconnect shows the `--state-error` "Connection lost"
      banner with a working Reload button
- [ ] Hard auth/connection failure still shows the full `RoomErrorBoundary`
      message (not the transient banner)
- [ ] AI: with the Trigger.dev worker stopped, a prompt ends in a clear,
      retryable error after the TTL (not a spinner forever)
- [ ] AI: an explicit refusal (e.g. asking for edges) shows the friendly
      refusal text with Retry
- [ ] AI: Retry after any error re-enables the composer and works
- [ ] AI: a failed generation spawns nothing on the canvas (append-only
      preserved)
- [ ] A forced `saveCanvas` failure shows "Save failed" with the message;
      a later successful save/autosave clears it
- [ ] A guest window also shows the reconnecting/lost banner on a drop
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No console errors (failures are handled, not thrown)
- [ ] Responsive at mobile and desktop
- [ ] `npm run build` passes
