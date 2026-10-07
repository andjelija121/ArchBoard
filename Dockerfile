# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# These commands need a URL to load the Prisma config, not a live database.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
RUN test -n "$pk_test_Y29tcGxldGUtYW50ZWF0ZXItNzAyNS5jbGVyay5hY2NvdW50cy5kZXYk" && \
    mkdir -p public && \
    DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
