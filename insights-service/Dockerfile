# ── insights-service multi-stage build (workspace-aware) ────────────────────
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY packages/ai-shared/package.json packages/ai-shared/
COPY insights-service/package.json insights-service/
RUN pnpm install --frozen-lockfile=false
COPY packages/ai-shared packages/ai-shared
COPY insights-service insights-service
RUN pnpm --filter @genxtaxi/ai-shared run build \
 && pnpm --filter insights-service run build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=builder /repo/packages/ai-shared/package.json packages/ai-shared/
COPY --from=builder /repo/packages/ai-shared/dist packages/ai-shared/dist
COPY --from=builder /repo/insights-service/package.json insights-service/
COPY --from=builder /repo/insights-service/dist insights-service/dist
RUN pnpm install --prod --frozen-lockfile=false
EXPOSE 8083
CMD ["node", "insights-service/dist/main.js"]
