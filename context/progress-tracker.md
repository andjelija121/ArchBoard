# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Editor chrome and Clerk auth wiring done. Prisma schema and board creation flow not started yet.

## Current Goal

- Scaffold the remaining base project pieces: Prisma schema (User, Board models) and the initial board creation flow (create board → empty React Flow canvas → save empty state to Postgres).

## Completed

- Clerk auth wiring (`context/feature-specs/03-auth.md`):
  - `proxy.ts` (root) — bare `clerkMiddleware()`, no path matching. Originally used `createRouteMatcher` for protected-first route gating, but Clerk deprecated that pattern in favor of resource-based checks (`auth.protect()` called directly in each page/layout) since path matching can diverge from how Next.js actually routes requests — see https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher. `proxy.ts` now only exists so `auth()`/`auth.protect()` work on the server; it grants no protection by itself. Named `proxy.ts` per spec (Next.js 16's rename of `middleware.ts`), same API.
  - `app/editor/page.tsx` — now an async Server Component that calls `await auth.protect()` before rendering `EditorShell`; this is where `/editor`'s actual protection lives post-migration.
  - `app/page.tsx`'s `await auth()` + `redirect()` check was already resource-based (no path matcher involved), so it didn't need to change.
  - Added `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` to `.env.local` — these are Clerk's own standard-named env vars (not present before), required by the spec's "use the existing sign-in and sign-up env vars" instruction; no custom var names invented.
  - `app/layout.tsx` — wraps `<html>` in `ClerkProvider` using `@clerk/ui`'s `dark` theme (per spec, not the `shadcn` theme despite `components.json` existing — spec named `dark` explicitly), with `variables` overridden to the app's existing CSS custom properties (`--accent-primary`, `--bg-elevated`, `--text-primary`, `--text-muted`, `--bg-surface`, `--border-default`, `--state-*`, `--radius`, `--font-sans`) — no hardcoded colors.
  - **Custom auth forms (deviation from spec's "use Clerk components / don't customize internals"):** the spec said to use `<SignIn />`/`<SignUp />`, but across two rounds the user explicitly required a specific custom form design (avatar + title, social icon buttons, mail/lock input icons, show-password eye toggle, "Keep me logged in" checkbox, "Forgot password?", a solid Login button) and no page scroll. Clerk's prebuilt component couldn't deliver that here: its `appearance` `elements`/`options` overrides were **silently ignored** by the classic clerk-js component even though `@clerk/ui`'s `dark` theme variables applied (two mismatched component systems), and it can't render input icons or a keep-logged-in checkbox at all. So the prebuilt components were replaced with custom flows built on Clerk's hooks. This is the documented, supported custom-flow path — auth logic still runs through Clerk — but it does own the markup. Recorded here as an intentional, user-driven override of the spec.
  - This `@clerk/nextjs` v7.9.7 exposes the **Future/signal hook API**, not the classic one: `useSignIn()` → `{ signIn, errors, fetchStatus }` where `signIn` has `.password({ identifier, password })`, `.sso({ strategy, redirectUrl, redirectCallbackUrl })`, `.finalize()`, and `.status`; `useSignUp()` → `signUp.password({ emailAddress, password })`, `signUp.verifications.sendEmailCode()/verifyEmailCode({ code })`, `.sso(...)`, `.finalize()`, `.status`. (The classic `signIn.create`/`setActive`/`authenticateWithRedirect` shape does NOT exist here — using it fails type-check.)
  - `components/auth/sign-in-form.tsx` (client) — email/password via `signIn.password` → on `status === "complete"`, `signIn.finalize()` then `router.push("/editor")`. Social via `signIn.sso` (redirect to `/sso-callback`, complete to `/editor`). Renders the reference form: `SocialButtons` row, OR divider, mail-icon email field, lock-icon password field with eye toggle, keep-me-logged-in + forgot-password row, solid Login button.
  - `components/auth/sign-up-form.tsx` (client) — two steps: (1) `signUp.password` + `signUp.verifications.sendEmailCode()`; (2) email-code entry → `verifyEmailCode` → `finalize` → `/editor`. Includes the required `<div id="clerk-captcha" />` for Clerk's default bot protection. Same visual language as sign-in.
  - `components/auth/social-buttons.tsx` (client) — icon buttons for the **enabled** providers only (Google + GitHub, with inline brand SVGs since Lucide dropped brand icons). The reference's Apple/LinkedIn aren't enabled on the instance, so they're omitted to avoid non-functional buttons; add entries here once enabled in the Clerk dashboard.
  - `components/auth/clerk-error.ts` — `getClerkErrorMessage()` handles both Clerk error shapes (`{ errors: [...] }` and a single `{ message, longMessage }`).
  - `app/sso-callback/page.tsx` — `<AuthenticateWithRedirectCallback />` completing OAuth redirects (falls back to `/editor`). Public (no `auth.protect()`).
  - `components/auth/auth-layout.tsx` — shared two-panel shell, redesigned per the user's reference: **form column LEFT** (always visible), **testimonial RIGHT** (`hidden lg:flex`). Root is `h-svh overflow-hidden` so the **whole page never scrolls** (fixes the earlier viewport scrollbar); the left column is `overflow-y-auto` only as a safety valve for very short viewports. Left column = top bar (`Boxes` logo + wordmark; switch link via `altPrompt`/`altLabel`/`altHref`), centered `User`-avatar + `title`/`subtitle` + form slot, footer (`© <year> ArchBoard` + decorative `Globe`/`ENG`).
  - `components/auth/auth-testimonial.tsx` — right panel: masked dot-grid background, standing title ("Trusted by engineers" + "Design the system before you build it.") replacing the reference's carousel dots, and one fabricated developer testimonial (Marcus Reyes, Staff Engineer, Nimbus Labs). Invented/placeholder content, not a real endorsement.
  - `app/sign-in/page.tsx` and `app/sign-up/page.tsx` — plain routes (the old Clerk `[[...sign-in]]`/`[[...sign-up]]` catch-alls were removed, no longer needed without Clerk's routing component) rendering the custom forms inside `AuthLayout`, each passing its own title/subtitle and the opposite page's switch link.
  - `app/page.tsx` — now a Server Component; `await auth()` and `redirect()` to `/editor` (authenticated) or `/sign-in` (unauthenticated), replacing the static placeholder. `/` is intentionally left public in `proxy.ts` so this explicit redirect (rather than middleware's implicit protect-redirect) is what satisfies the spec's `/` requirement.
  - `components/editor/editor-navbar.tsx` — added Clerk's `<UserButton />` to the navbar's right section (previously an empty placeholder), left untouched otherwise (default Clerk menu/profile flows, no customization).
  - Installed `@clerk/ui` (still used for the `dark` theme on `<UserButton />` via the provider). `@clerk/nextjs` was already installed.
  - Verified: `npm run build` and `npm run lint` pass with zero errors; `npm run dev` smoke test — `/sign-in`, `/sign-up`, `/sso-callback` all 200, custom form markup present (social buttons, email/password, keep-me-logged-in, forgot-password, Login), no runtime errors in the dev log. Visual/pixel review and a real end-to-end login/sign-up round-trip still pending (not screenshot-verified; OAuth requires the provider redirect).
  - Open follow-ups: "Forgot password?" is a non-functional placeholder button (reset flow not built); "Keep me logged in" is cosmetic (Clerk manages session persistence); only Google + GitHub social providers are wired (whatever is enabled on the instance).

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

- Scaffold Prisma schema (User, Board) and the initial board creation flow.

## Open Questions

- `--radius` and the node-category canvas palette (`--node-*`) from `ui-context.md` were not added — no canvas components exist yet to consume them; add when `components/canvas/` is scaffolded.
- `02-editor.md` didn't specify who owns the open/closed state shared by `editor-navbar.tsx` and `project-sidebar.tsx`, or a fixed width for the project sidebar. Made both components controlled (parent passes `isSidebarOpen`/`isOpen` + toggle callbacks) and picked `w-80` (320px, standard Tailwind scale) for the sidebar width, distinct from the 360px AI chat sidebar `ui-context.md` defines elsewhere. Neither is wired into a page yet — no editor page/layout exists to mount them.
- `02-editor.md` didn't assign a z-index layer to the project sidebar specifically; reused `z-40` (the "AI chat sidebar / property panel" layer from `ui-context.md`'s hierarchy) since it's the closest matching floating-panel-over-canvas layer.

## Architecture Decisions

- Auth protection is resource-based, not path-based: each protected page/route calls `await auth.protect()` itself (e.g. `app/editor/page.tsx`) rather than `proxy.ts` gating by URL pattern. This follows Clerk's `createRouteMatcher` deprecation guidance and means adding a new protected route (or future dynamic board routes) requires adding the check to that route's own page, not editing `proxy.ts`.
- `/` does its own `auth()` + `redirect()`, which was already resource-based, so the spec's "authenticated → /editor, unauthenticated → /sign-in" behavior for `/` lives in one readable place (`app/page.tsx`).
- shadcn/ui installed via the `shadcn` CLI v4 (`radix-nova` preset) rather than the classic v2 CLI, since that's what `npx shadcn@latest` currently resolves to. Uses Radix primitives (`radix-ui` package) and the official `cn` npm package instead of a hand-rolled `clsx` + `tailwind-merge` util — functionally equivalent to the classic setup.
- Dark mode is forced via a static `dark` class on `<html>` rather than a `next-themes` provider, since the product has no light mode or theme toggle (per `ui-context.md`).

## Session Notes

- `components/ui/*` are generated primitives — do not hand-edit them (see `ai-workflow-rules.md` protected files); extend via wrapper components in `components/canvas/` or `components/ai/` when those features are built.
