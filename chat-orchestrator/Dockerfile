# ── chat-orchestrator multi-stage build (workspace-aware) ───────────────────
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY packages/ai-shared/package.json packages/ai-shared/
COPY chat-orchestrator/package.json chat-orchestrator/
RUN pnpm install --frozen-lockfile=false
COPY packages/ai-shared packages/ai-shared
COPY chat-orchestrator chat-orchestrator
RUN pnpm --filter @genxtaxi/ai-shared run build \
 && pnpm --filter chat-orchestrator run build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=builder /repo/packages/ai-shared/package.json packages/ai-shared/
COPY --from=builder /repo/packages/ai-shared/dist packages/ai-shared/dist
COPY --from=builder /repo/chat-orchestrator/package.json chat-orchestrator/
COPY --from=builder /repo/chat-orchestrator/dist chat-orchestrator/dist
RUN pnpm install --prod --frozen-lockfile=false
EXPOSE 8082
CMD ["node", "chat-orchestrator/dist/main.js"]
