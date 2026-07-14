# ── currency-service multi-stage build (workspace-aware) ────────────────────
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY packages/ai-shared/package.json packages/ai-shared/
COPY currency-service/package.json currency-service/
RUN pnpm install --frozen-lockfile=false
COPY packages/ai-shared packages/ai-shared
COPY currency-service currency-service
RUN pnpm --filter @genxtaxi/ai-shared run build \
 && pnpm --filter currency-service run build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=builder /repo/packages/ai-shared/package.json packages/ai-shared/
COPY --from=builder /repo/packages/ai-shared/dist packages/ai-shared/dist
COPY --from=builder /repo/currency-service/package.json currency-service/
COPY --from=builder /repo/currency-service/dist currency-service/dist
RUN pnpm install --prod --frozen-lockfile=false
EXPOSE 8081
CMD ["node", "currency-service/dist/main.js"]
