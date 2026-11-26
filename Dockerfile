# Build from the project root:
#   docker build -t triaje .
#   docker run -p 8080:8080 --env-file backend/.env triaje

# ── Stage 1: build React dashboard ────────────────────────────────────────────
FROM node:20-slim AS react-builder
WORKDIR /dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ── Stage 2: build NestJS backend ──────────────────────────────────────────────
FROM node:20-slim AS nest-builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ── Stage 3: minimal production image ─────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# NestJS compiled output
COPY --from=nest-builder /app/dist ./dist
# Production deps only
COPY backend/package*.json ./
RUN npm ci --omit=dev
# React build; NestJS reads STATIC_PATH to find it
COPY --from=react-builder /dashboard/dist ./public
ENV STATIC_PATH=/app/public
EXPOSE 8080
CMD ["node", "dist/main"]
