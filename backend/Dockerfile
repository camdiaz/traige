# ── Stage 1: build React dashboard ────────────────────────────────────────────
FROM node:20-slim AS react-builder
WORKDIR /dashboard
COPY ../dashboard/package*.json ./
RUN npm ci
COPY ../dashboard/ ./
RUN npm run build

# ── Stage 2: build NestJS backend ──────────────────────────────────────────────
FROM node:20-slim AS nest-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 3: production image ──────────────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# NestJS dist
COPY --from=nest-builder /app/dist ./dist
# Production deps only
COPY package*.json ./
RUN npm ci --omit=dev
# React build served by ServeStaticModule → STATIC_PATH env var
COPY --from=react-builder /dashboard/dist ./public
ENV STATIC_PATH=/app/public
EXPOSE 8080
CMD ["node", "dist/main"]
