# Unit 15: Persistence Integration (autosave + flush + load-into-room)

## Goal

Close the storage loop so collaborative edits persist without a manual
click: the Postgres snapshot loads into the Liveblocks room on open, and
live Liveblocks state flushes back to the `Project.canvas` JSONB column on a
**debounced autosave (~2s after editing stops)** and on explicit Save. The
navbar save-status indicator reflects saved / pending (dirty) / saving /
error truthfully for both paths.

## Design

No new UI surface — this unit makes the **existing** save-status indicator
and Save button in `board-editor.tsx` honest about autosave. The
`SaveStatusValue` machine (`clean | dirty | saving | saved | error`) and the
`SaveStatus` chrome already exist; this unit drives them from a debounce
timer instead of only from the manual button.

Visible result: edit the board (alone or with another window), stop
touching it, and within ~2s the indicator goes `Unsaved → Saving… → Saved`
with no click; reload and the last state is there.

### Autosave cadence (resolved in the build plan)

- **Debounced only.** Each edit (anything that marks the board dirty)
  (re)starts a ~2000ms timer; the flush fires only once editing pauses. No
  fixed-interval cap, so a continuous drag never fights a periodic save.
- **Manual Save = immediate flush**, cancelling any pending debounce.
- A flush already in flight does not get interrupted; edits landing during
  a flush keep the board `dirty` (the existing `editVersion` guard in
  `handleSave` already encodes this — reuse it).

### Load-into-room (already in place, documented here)

Unit 13's `LiveRoom` seeds Storage from the Postgres snapshot via
`initialStorage` **only when the room is empty**. This unit does not change
that. The one wrinkle it must acknowledge: Liveblocks retains room Storage
after everyone disconnects, so a later rejoin shows the **last live state**,
which — now that autosave exists — is kept in sync with Postgres anyway.
The remaining divergence (room emptied by Liveblocks, DB newer/older) is
reconciled by autosave keeping them equal in practice; no load-time
conflict resolution is added in this unit (note as a known edge if the room
is evicted mid-session with unsaved edits).

## Implementation

### 1. Debounced autosave hook — `components/canvas/use-autosave.ts` (new, `"use client"`)

Extract the save lifecycle out of `board-editor.tsx` into one hook so the
debounce, the in-flight guard, and the status machine live together:

```ts
interface UseAutosaveOptions {
  projectId: string
  getSnapshot: () => CanvasSnapshot  // reads current nodes/edges from the hook
  enabled: boolean                   // false for guests (see §4)
  delayMs?: number                   // default 2000
}

interface UseAutosave {
  status: SaveStatusValue
  error: string | null
  markDirty: () => void   // replaces board-editor's local markDirty
  saveNow: () => void     // manual Save button; immediate flush
}
```

Behavior:

- `markDirty()` bumps an internal `editVersion` ref, sets status `dirty`,
  and (if `enabled`) schedules a flush after `delayMs`, clearing any prior
  timer. This is the callback `useLiveCanvas({ onMutate })` already calls on
  every Storage change, so autosave triggers on **local and remote** edits
  (the owner's window persisting a guest's change is the intended path —
  see §4).
- `flush()` (internal; also the body of `saveNow`): cancel the timer, guard
  against double-run while a save is in flight, snapshot `editVersion`, set
  `saving`, call `saveCanvas({ projectId, snapshot: getSnapshot() })`. On
  success, set `saved` iff `editVersion` is unchanged, else back to `dirty`
  (reusing Unit 7's mid-flight logic). On failure set `error` + message.
- `saveNow()` cancels the debounce and flushes immediately; it is a no-op
  when already `clean`/`saved` with no pending edits (same disabled
  condition the Save button uses today).
- Clear the timer on unmount. Use `useTransition` or a plain async guard —
  match the existing `isPending` usage.
- **Flush on unload (best-effort):** on `beforeunload`, if the board is
  `dirty`, attempt a synchronous-ish flush. A Server Action can't be
  awaited in `beforeunload`; document this as best-effort and rely on the
  2s debounce normally. Do **not** block navigation.

### 2. Wire into `board-editor.tsx`

- Replace the inline `status`/`saveError`/`markDirty`/`handleSave` block
  with `useAutosave({ projectId, getSnapshot: () => ({ nodes, edges }),
  enabled: access === "owner" })`.
- `useLiveCanvas({ onMutate: markDirty })` stays — it now feeds the
  debounce.
- The navbar Save button calls `saveNow`; its `disabled` logic and the
  `SaveStatus` display are unchanged (they already read `status`/`error`).
- Because autosave sets `saved` on its own, the user sees the indicator
  settle without clicking; the button remains for an explicit immediate
  flush.

### 3. `saveCanvas` Server Action — unchanged contract

No signature change. It still Zod-validates, writes through the
owner-scoped `updateMany`, and returns `{ ok } | { ok: false, error }`.
Autosave simply calls it more often. Confirm it stays idempotent and cheap
(single `UPDATE` of one JSONB column); no `revalidatePath` (would clobber
live state — already the case).

### 4. Who persists (decision — flag for review)

`saveCanvas` is **owner-scoped** (`updateMany` guarded by `ownerId`). So:

- The **owner's** client is the one that persists. Its `onMutate` fires on
  every Storage change — including edits made by a guest — so the owner's
  window autosaves the shared state. This is the intended design: Postgres
  is the owner's persistent snapshot.
- **Guests** pass `enabled: false` to `useAutosave` and show **no** Save
  button / no status indicator. Their edits live in Liveblocks and are
  persisted by the owner's present client.
- **Edge case:** if a guest edits while **no owner** window is open, nothing
  is written to Postgres until an owner rejoins (at which point the owner's
  window sees the live Storage as `dirty` and autosaves it). This is
  acceptable under the architecture's "Liveblocks = live truth, Postgres =
  owner snapshot" model. Documented as a known limitation; a server-side
  (Trigger.dev / webhook) persistence path is explicitly **out of scope**
  for this unit.

> If you instead want guests' edits to persist with no owner present, that
> requires a non-owner-scoped persistence path (e.g. a share-token-scoped
> save action or a Liveblocks Storage webhook into Trigger.dev). Say so and
> this unit's scope expands; otherwise the owner-persists model stands.

### 5. Status semantics across clients

`useLiveCanvas`'s `onMutate` already fires on remote Storage changes, so the
owner's indicator correctly flips to `Unsaved` when a guest edits, then
autosaves. A guest window shows no indicator (per §4). Selection and
measurement never touch Storage (Unit 13), so they still never dirty the
board or trigger an autosave.

## Dependencies

- None new. Reuses `@xyflow/react`, the Liveblocks hooks, and the existing
  `saveCanvas` Server Action.

## Verify when done

- [ ] Editing the board and pausing ~2s autosaves: the indicator goes
      `Unsaved → Saving… → Saved` with no click
- [ ] Rapid continuous edits (e.g. a long drag) debounce to a single flush
      after the drag stops, not one save per tick
- [ ] Manual Save flushes immediately and cancels any pending debounce
- [ ] An edit landing while a save is in flight leaves the board `Unsaved`
      (not falsely `Saved`), then autosaves again
- [ ] Reopening the board shows the last autosaved state from Postgres
- [ ] With two windows (owner + guest edit link), a guest's edit flips the
      owner's indicator to `Unsaved` and autosaves; reload shows it
- [ ] A guest window shows no Save button and no status indicator
- [ ] A forced `saveCanvas` failure surfaces the `error` status with the
      message (indicator shows "Save failed"), and a later successful
      autosave clears it
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No console errors
- [ ] Responsive at mobile and desktop
- [ ] `npm run build` passes
