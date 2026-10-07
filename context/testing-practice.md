# Testing practice for ArchBoard

## What is implemented

Vitest 4 runs ten tests in tests/canvas-sync.test.ts. They run in Node without a browser, database or API credentials. Version 4 fits the existing Node 20 types; the newest major required newer types. The configuration only discovers tests/**/*.test.ts.

Run once: `npm test`
Run continuously while learning: `npm run test:watch`
Run one test: `npm test -- -t "keeps selection"`
Check TypeScript separately: `npm run typecheck`

## Read each test

A test follows Arrange, Act, Assert: prepare sample data, call the function, check the result. `describe` groups examples; `it` describes the expected behavior. `toEqual` compares content, while `toBe` compares identity for objects. `vi.spyOn` observes calls to a real method.

1. **Private node state:** selection, measured size, dragging and resizing must not leak to another collaborator. Board ID, position and data must survive. Also verifies the input is untouched.
2. **JSON-safe data:** undefined values are removed from nested data. Changing the original afterward must not change the stored copy.
3. **Private edge state:** selection stays local while source and target stay shared.
4. **JSON equality:** object key order is irrelevant, but array order and changed values matter. This prevents unnecessary network writes without hiding changes.
5. **Minimal storage updates:** a real LiveObject loses obsolete fields and accepts changed fields. The spy verifies equal fields do not cause writes.
6. **List reconciliation:** a removed node disappears, a surviving node updates in place, and a newly prepended group stays before its member. This tests a particular supported update, not arbitrary sorting of existing nodes.
7. **Local merge:** the local selection overlays shared content without modifying it. Stable references avoid unnecessary React Flow renders.
8. **Overlay cleanup:** removed nodes lose their local state. Unchanged nodes reuse their previous state object.
9. **Node changes:** selection, dimensions and drag flags update together. Position itself is shared data, so it is excluded from the local overlay. Removal clears local state.
10. **Edge changes:** repeated selection causes no new state object; removal cleans up the entry.

Practice: run the watcher, temporarily change one expected value and read the failure. Restore it. Then add a test that selecting a node twice returns the same overlay reference. Add another for removing an ID that was never present. Assert the behavior you want before reading the implementation.

These tests cover synchronization helpers; they do not prove authentication, saving, connection recovery or AI generation works in a deployed app.

## Other tests to practice next

| Kind | ArchBoard example | What you verify |
| --- | --- | --- |
| Schema/unit | Parse an invalid canvas snapshot | Missing IDs or malformed positions are rejected |
| Component/hook | Change a mocked connection status to disconnected | Lost banner and Reload appear; reconnect timer clears correctly |
| Integration | Save a board using a test database | Correct owner can save; a different user cannot; saved JSON reloads |
| End-to-end | Sign in, create board, add node, save, reload | Browser, auth, server and persistence cooperate |
| Failure recovery | Reject a save or simulate a failed AI run | Error is visible, Retry works, failed generation adds nothing |
| Multiplayer | Open the same board in two browser contexts | Shared changes arrive; selections remain private |
| Deployment smoke | Open the app after rollout | The deployed build starts and a basic user journey succeeds |

Component tests need React Testing Library and a DOM environment; mock external hooks and use fake timers for reconnection timers. Integration tests need an isolated test database and deliberate test-user ownership fixtures. E2E tests use Playwright and a Clerk development instance, with credentials outside the repository. Never run destructive test cleanup against production.

Start browser tests against a production build (`npm run build`, then `npm start`) to catch behavior that differs from development. Make failure tests deterministic with controlled errors; keep a separate manual exercise for actual network outages and a stopped Trigger.dev worker.

Resources: [Vitest guide](https://vitest.dev/guide/), [Next.js Playwright setup](https://nextjs.org/docs/app/guides/testing/playwright), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

## How this reaches Kubernetes

For your practice project, Kubernetes is a useful next stage. First make checks pass locally. In GitHub Actions, run `npm ci`, Prisma generation, lint, typecheck, `npm test`, and a production build. Run integration/browser tests against isolated services. Only a successful required check should allow a release to proceed.

Build an image tagged with the commit SHA, push it to a registry, then deploy that exact image to a local kind cluster first. Add a Deployment and Service; configure startup, readiness and liveness probes. A readiness failure removes the pod from service traffic; a liveness failure can restart it; a startup probe gives it time to boot. These probes are operational checks, not substitutes for your tests. Avoid making liveness depend on every external provider being available.

Practice rollout by deploying a second image and watching `kubectl rollout status deployment/archboard`. Then practice a deliberately broken image in the local cluster and recover with `kubectl rollout undo deployment/archboard`. After rollout, run a smoke test; rollout success alone does not verify the full app. Database changes should remain compatible with old and new pods during deployment; rolling back an image does not undo a database migration.

[Kubernetes probe instructions](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/), [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/), [GitHub Actions quick start](https://docs.github.com/en/actions/writing-workflows/quickstart).

Docker, Kubernetes manifests, GitHub workflows, component tests and browser tests are future exercises, not implemented in this step.

## Verified results
- All ten tests pass.
- npm run typecheck passes.
- npm run build passes.


## Step 2: check the running process
Start the app with npm run dev, then open http://localhost:3000/api/health without signing in. Expected body: { status: ok } (JSON). In PowerShell use: Invoke-WebRequest http://localhost:3000/api/health. StatusCode should be 200.
The route.ts file defines the URL; its GET function handles HTTP GET requests. Response.json produces the JSON body and defaults to HTTP 200. Cache-Control: no-store prevents clients from caching an old response. Both proxy matchers exclude this exact endpoint so Clerk does not process probes.
Later Kubernetes can request this path for process health. This response proves the server responds, not that saving, authentication or AI works. Dependency-aware readiness would be a separate future check.

