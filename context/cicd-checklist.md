# ArchBoard CI/CD checklist

Status recorded on October 7, 2026. Checked boxes mean work completed and verified in this chat. Unchecked boxes include work that is written but still needs verification.

CI (continuous integration) checks changes before merging. CD (continuous delivery/deployment) packages and releases a successful build. Kubernetes runs the released containers.

## 1. Add tests — partially complete

- [x] Install Vitest and configure Node-based unit tests.
- [x] Write ten tests for canvas synchronization helpers.
- [x] Add `npm test`, `npm run test:watch`, and `npm run typecheck` scripts.
- [x] Verify all ten tests, TypeScript, and the production build pass.
- [ ] Add Playwright browser tests: sign in, create a board, add a node, save, and reload.
- [ ] Configure Clerk test authentication using a development instance.

Files: [tests](../tests/canvas-sync.test.ts), [configuration](../vitest.config.mts), [test explanations](testing-practice.md).

References: [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest), [Next.js Playwright guide](https://nextjs.org/docs/app/guides/testing/playwright), [Clerk testing](https://clerk.com/docs/testing/playwright/overview).

## 2. Add a health endpoint — complete

- [x] Add public `GET /api/health`, returning HTTP 200 and `{"status":"ok"}`.
- [x] Exclude its exact path from both Clerk proxy matchers.
- [x] Prevent caching with `Cache-Control: no-store`.
- [x] Verify an unauthenticated request against the production server.

File: [health route](../app/api/health/route.ts). This checks that Next.js responds; it does not prove the database or external providers are healthy.

## 3. Dockerize — container working; final checks pending

- [x] Enable Next.js `output: "standalone"`.
- [x] Add a multi-stage Dockerfile with dependency installation and Prisma client generation.
- [x] Add `.dockerignore` to exclude credentials, Windows dependencies, and old build output.
- [x] Verify the local standalone production build generates `server.js`.
- [x] Confirm Docker CLI and Docker Desktop are installed from the output/screenshots supplied in this chat.
- [x] Resolve Docker Desktop startup requirements; user reports the container now runs.
- [x] Start Docker Desktop successfully (running container shown by user).
- [x] Build the image (user completed the Docker guide).
- [x] Run it with runtime environment variables from ignored `.env.docker`.
- [x] Resolve the Prisma connection error and confirm the site loads (user verified).
- [ ] Explicitly verify container `/api/health`, sign-in, and board loading/saving.

Docker now runs. A quoted DATABASE_URL caused Prisma P1001; using unquoted entries in ignored .env.docker resolved the page-loading error, as confirmed by the user.

Files: [Dockerfile](../Dockerfile), [ignore rules](../.dockerignore), [complete Docker instructions](docker-practice.md).

References: [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## 4. Push images to a registry — not started

- [ ] Configure GitHub Container Registry (GHCR).
- [ ] Build and tag an image with its Git commit SHA.
- [ ] Authenticate and push the image.
- [ ] Verify it can be pulled; configure cluster access if the image is private.

A registry stores the image so Kubernetes can download it. [GHCR instructions](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## 5. Run Kubernetes locally — not started

- [ ] Install `kubectl`.
- [ ] Create a local cluster using kind or Docker Desktop Kubernetes.
- [ ] Create `k8s/` manifests: Deployment, Service, runtime configuration, and Secret references.
- [ ] Keep actual secret values outside committed manifests.
- [ ] Configure startup, readiness, and liveness probes.
- [ ] Make the image available to the cluster and deploy it.
- [ ] Verify pods, logs, health endpoint, and app behavior.
- [ ] Practice a rolling update and rollback.
- [ ] For domain access, choose a supported ingress or Gateway controller; configure TLS when needed.

The original plan suggested ingress-nginx; verify controller maintenance and compatibility before choosing it. Local practice can start with port forwarding without a domain or TLS.

References: [Kubernetes basics](https://kubernetes.io/docs/tutorials/kubernetes-basics/), [kind setup](https://kind.sigs.k8s.io/docs/user/quick-start/), [kubectl installation](https://kubernetes.io/docs/tasks/tools/), [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/), [Services](https://kubernetes.io/docs/concepts/services-networking/service/), [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/), [probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/), [cert-manager](https://cert-manager.io/docs/).

## 6. Get a hosted cluster — not started

- [ ] Choose a provider and review current pricing.
- [ ] Create the cluster and configure access credentials.
- [ ] Configure registry access, runtime secrets, networking, and HTTPS.
- [ ] Deploy the app and check its public domain.
- [ ] Add the production domain to the relevant Clerk configuration.

This comes after local practice. Provider examples from the original plan: [DigitalOcean Kubernetes](https://docs.digitalocean.com/products/kubernetes/getting-started/quickstart/), [GKE Autopilot](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview).

## 7. Write the CI workflow — not started

- [ ] Create `.github/workflows/ci.yml` for pull requests and the development branch.
- [ ] Use a Node version compatible with the Docker image and dependency requirements.
- [ ] Run `npm ci`, Prisma generation, lint, typecheck, unit tests, and production build.
- [ ] Supply build configuration without exposing private keys.
- [ ] Make successful CI a required check before merging into `main`.
- [ ] Confirm a deliberately failing test blocks the check, then restore it.

Writing local tests does not automatically run them on GitHub. This workflow makes that happen.

References: [Actions quickstart](https://docs.github.com/en/actions/writing-workflows/quickstart), [branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## 8. Write the CD workflow — not started

- [ ] Create `.github/workflows/deploy.yml` for releases from `main`, gated on successful checks.
- [ ] Build and push an image tagged with the commit SHA.
- [ ] Run `prisma migrate deploy` as a separate deployment operation.
- [ ] Keep migrations compatible with both old and new pods during rollout.
- [ ] Deploy Trigger.dev tasks using the project's version-matched CLI.
- [ ] Update the Kubernetes Deployment to the exact released image.
- [ ] Wait for rollout completion and run a smoke test.
- [ ] Configure a GitHub `production` environment and optional approval gate.
- [ ] Prevent concurrent production deployments.
- [ ] Practice recovery: image rollback does not undo database migrations.

References: [Docker build/push action](https://github.com/docker/build-push-action), [Prisma production migrations](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate), [Trigger.dev Actions](https://trigger.dev/docs/github-actions), [GitHub environments](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment).

## 9. Run end-to-end tests in CI — not started

- [ ] Run Playwright against a production build in an isolated test environment.
- [ ] Use a separate database and Clerk development instance.
- [ ] Set up repeatable test data and cleanup.
- [ ] Upload failure screenshots/traces as CI artifacts.
- [ ] Test saving, guest collaboration, and selected failure/retry paths.

Writing browser tests in step 1 and running them automatically in CI are separate tasks. Never use production data for destructive test setup or cleanup.

## Configuration and secrets — pending for deployment

- [ ] Configure GitHub Actions credentials and environment variables.
- [ ] Configure Kubernetes runtime secrets separately.
- [ ] Configure Trigger.dev production worker variables.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public browser key, supplied during image build; runtime must match |
| `DATABASE_URL` | Web app runtime and separate migration operation |
| `CLERK_SECRET_KEY` | Web app authentication |
| `LIVEBLOCKS_SECRET_KEY` | Web app room authorization |
| `TRIGGER_SECRET_KEY` | Web app triggering production tasks |
| `TRIGGER_ACCESS_TOKEN` | CI deploying Trigger.dev tasks |
| Cluster credentials, such as `KUBE_CONFIG` | CI deploying to Kubernetes; provider identity may be an alternative |
| `GROQ_API_KEY` | Trigger.dev worker environment |

Local credentials may already exist; that does not establish production or GitHub configuration. [GitHub secret instructions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

## Suggested next action

Finish Docker engine setup and verify the container in step 3. Step 7 (CI) can also be built independently of local Docker. Continue with local Kubernetes once your image runs successfully.

