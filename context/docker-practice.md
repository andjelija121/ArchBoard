# Docker practice: ArchBoard

## What Docker adds

An image packages the built app, Node.js and its required files. A container is a running instance of that image, with its own processes, filesystem and network. You can run multiple containers from one image. Docker Desktop supplies the Linux engine on Windows, using a Linux environment through WSL 2. Docker CLI commands talk to that engine. Kubernetes later schedules containers from the image you publish.

This image runs the Next.js web app. Your existing PostgreSQL, Clerk, Liveblocks and hosted Trigger.dev worker remain external. Starting this container does not start the Trigger.dev development worker or migrate your database.

## Install once

Follow [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Use the WSL 2/Linux containers setup described there. Open Docker Desktop and wait for the engine to start, then reopen your terminal. Run `docker version`: both Client and Server information should appear. A client with no server means the engine is unavailable.

Docker was not found in the terminal when these files were added; a Docker build and container run have not yet been verified.

## Every Dockerfile instruction

| Instruction | Meaning and why it is here |
| --- | --- |
| `# syntax=docker/dockerfile:1` | Selects Docker's current stable Dockerfile frontend, which parses the recipe. |
| `FROM node:24-bookworm-slim AS base` | Starts from an official image containing Node 24 on Debian Bookworm. slim reduces unrelated OS tools. Node 24 matches the local runtime inspected during setup. The tag can receive updates; it is not an immutable digest. |
| `WORKDIR /app` | Makes /app the directory for following commands inside the image. It is not your Windows project folder. |
| `ENV NEXT_TELEMETRY_DISABLED=1` | Disables Next.js telemetry during build and runtime; not a requirement for serving the app. |
| `FROM base AS dependencies` | Creates an installation stage from the common base. |
| `COPY package.json package-lock.json ./` | Copies dependency descriptions before source code, so code-only edits can reuse the installation cache. |
| `RUN npm ci` | Installs versions from the committed lock file. Development dependencies are needed here for compilation and Prisma generation. |
| `FROM base AS builder` | Creates a stage for compiling the app. |
| `COPY --from=dependencies ...` | Reuses the Linux dependencies installed in the previous stage instead of your Windows node_modules. |
| `COPY . .` | Copies the build context into /app, excluding .dockerignore entries. |
| `ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Accepts the public Clerk key at build time. Next.js embeds public browser variables into the build, so changing this key requires rebuilding. ARG is not a safe place for private secrets. |
| `RUN DATABASE_URL=... npx prisma generate` | Generates the Prisma client from the schema. The fake URL lets prisma.config.ts load; generation does not create tables or connect to a database. The URL exists only for that command. |
| `test -n ...` | Fails early if the public Clerk build argument was omitted. |
| `mkdir -p public` | Creates an empty public folder if absent, so copying assets later works whether or not you add public assets. |
| `DATABASE_URL=... npm run build` | Compiles the production app. Imported database code needs a URL even during compilation. No real database credentials are placed in the image. If future static pages query the database during build, this setup must be reconsidered. |
| `&&` and backslash | In this Dockerfile's Linux shell, && runs the next command only after success; backslash continues a line. These are not PowerShell continuation instructions. |
| `FROM base AS runner` | Creates the final image. The full source tree and full build dependencies are left in earlier stages. |
| `ENV NODE_ENV=production` | Selects production behavior for Node libraries. |
| `ENV PORT=3000` | Tells the generated Next.js server which container port to listen on. |
| `ENV HOSTNAME=0.0.0.0` | Listens on all container network interfaces so mapped traffic can reach the server. |
| `COPY ... .next/standalone` | Copies the minimal Next.js server and traced runtime dependencies. Enabled by output: standalone in next.config.ts. |
| `COPY ... .next/static` | Copies generated browser JavaScript and CSS, which standalone does not include automatically. |
| `COPY ... public` | Copies public assets, which standalone also does not include automatically. |
| `--chown=node:node` | Gives the bundled node user ownership of these files, including areas Next.js may need for runtime caches. |
| `USER node` | Runs the server as the bundled unprivileged user rather than root. |
| `EXPOSE 3000` | Documents the intended container port. It does not publish a port to Windows. |
| `CMD ["node", "server.js"]` | Default startup command. It executes the generated server directly; startup happens when running a container, not while building an image. |

Multiple stages keep build tools out of the final image. This is called a [multi-stage build](https://docs.docker.com/build/building/multi-stage/). Each build instruction can contribute cached filesystem layers, so Docker can reuse unchanged work.

## Why .dockerignore matters

Docker's build context is the set of files the builder can access. The dot at the end of docker build selects this project as the context. .dockerignore filters those files; it is separate from .gitignore.

- node_modules and .next: exclude Windows dependencies and old compiled output; generate fresh Linux versions.
- .env*, *.pem, *.key: exclude environment files and private key files from the context. Keep all private credentials out of Dockerfile ARG/ENV instructions.
- lib/generated/prisma: generate a fresh client inside the build.
- .git, agent folders, caches and logs: reduce unrelated content sent to the builder.
- .trigger: exclude local worker build artifacts; the web app does not run that worker.

## Build your image

From the ArchBoard project directory, replace the public-key example with your actual Clerk development publishable key (the same key used by .env.local):

```powershell
docker build --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME -t archboard:local .
```

- `build`: executes the Dockerfile to create an image; does not launch the app.
- `--build-arg`: supplies the Dockerfile ARG; this key is public.
- `-t archboard:local`: assigns image name archboard and tag local, so you can refer to it later. This does not upload anything.
- `.`: uses this directory as the context.

The first build downloads the base image and npm packages, and Next.js downloads Google fonts used by app/layout.tsx. Later builds can reuse caches.

## Run the image

For this local exercise, use your existing uncommitted .env.local. Docker's env-file expects plain NAME=value lines: avoid shell export statements, surrounding quotes and multiline values; it does not expand references to other variables. If your file uses those features, create a separate ignored .env.docker with compatible entries.

```powershell
docker run --name archboard-local --rm -p 127.0.0.1:3000:3000 --env-file .env.local archboard:local
```

- `run`: creates a container and starts its CMD.
- `--name`: gives this instance a name for logs, exec and stop commands.
- `--rm`: removes this container after it stops; the image remains available.
- `-p 127.0.0.1:3000:3000`: maps Windows localhost port 3000 to container port 3000. Stop npm run dev first if it already owns that port. Or use 127.0.0.1:3001:3000 and browse localhost:3001.
- `--env-file`: injects configuration when starting this container. The file is not copied into the image. The runtime public Clerk key should match the build key.
- `archboard:local`: selects the image to run.

Runtime needs DATABASE_URL, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, LIVEBLOCKS_SECRET_KEY and TRIGGER_SECRET_KEY for the corresponding features. Keep GROQ_API_KEY in the Trigger.dev worker environment; the web container does not execute Groq requests. Clerk redirect-path variables, if configured locally, should also be consistent with your build/runtime setup.

A managed database URL works from the container if its host is reachable. If your database runs on Windows localhost, localhost inside the container points to the container itself: use host.docker.internal for the database hostname in an ignored Docker-specific env file.

## Inspect and stop it

In a second terminal:

```powershell
Invoke-WebRequest http://localhost:3000/api/health
docker ps
docker logs archboard-local
docker exec archboard-local node --version
docker stop archboard-local
```

The HTTP request should return 200 and {"status":"ok"}; then open the app and check sign-in and board loading. `ps` lists running containers, `logs` reads the server output, `exec` runs an extra command inside an existing container, and `stop` requests shutdown. Since --rm was used, restarting means running the run command again.

No bind mount is used: your source edits do not appear in a running production container. Rebuild the image and run a new container after changing code. A volume is persistent storage independent of a container; no volume is needed for board data here because PostgreSQL already owns persistence. Docker Compose defines multiple services together; it is optional and unnecessary for this first single-container exercise. A registry stores images for other machines to download; we will use it before deploying to Kubernetes. Kubernetes will manage container restarts, replicas and probes from its manifests.

## Verification boundary

A successful local Next.js standalone build checks packaging configuration. It cannot prove npm installation, Linux file tracing and server startup work inside the Docker image. Finish verification with a real Docker build, the public health request and a browser smoke test once Docker Desktop is available. Migrations remain a separate deployment step; the final runtime image deliberately does not carry the Prisma CLI.

Official references: [Docker Desktop Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/), [Dockerfile reference](https://docs.docker.com/reference/dockerfile/), [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [build secret mounts for future private build dependencies](https://docs.docker.com/build/building/secrets/).

Local verification completed: production build and TypeScript pass, and .next/standalone/server.js is generated. Docker image build/run remain unverified.


### Database error after startup
A quoted DATABASE_URL in .env.local is not compatible with Docker env-file parsing: Docker preserves the quote characters. Use the ignored .env.docker file with plain unquoted NAME=value entries, then recreate the container with --env-file .env.docker. Restarting an existing container does not reload its environment file. Do not commit or paste this file; it contains credentials.

