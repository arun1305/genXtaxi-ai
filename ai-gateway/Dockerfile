# ── ai-gateway multi-stage build (workspace-aware) ──────────────────────────
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo

# Copy workspace manifests first for cached installs
COPY pnpm-workspace.yaml package.json ./
COPY packages/ai-shared/package.json packages/ai-shared/
COPY ai-gateway/package.json ai-gateway/
RUN pnpm install --frozen-lockfile=false

# Copy sources and build shared lib + gateway
COPY packages/ai-shared packages/ai-shared
COPY ai-gateway ai-gateway
RUN pnpm --filter @genxtaxi/ai-shared run build \
 && pnpm --filter ai-gateway run build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=builder /repo/packages/ai-shared/package.json packages/ai-shared/
COPY --from=builder /repo/packages/ai-shared/dist packages/ai-shared/dist
COPY --from=builder /repo/ai-gateway/package.json ai-gateway/
COPY --from=builder /repo/ai-gateway/dist ai-gateway/dist
RUN pnpm install --prod --frozen-lockfile=false
EXPOSE 8080
CMD ["node", "ai-gateway/dist/main.js"]
