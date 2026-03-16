# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY frontend/package.json frontend/
COPY compiler-shim/package.json compiler-shim/
COPY backend/package.json backend/

RUN pnpm install --frozen-lockfile || pnpm install

COPY tsconfig.base.json ./
COPY compiler-shim/ compiler-shim/
COPY frontend/ frontend/

RUN pnpm --filter frontend build

# Stage 2: Build backend
FROM node:22-alpine AS backend-build

WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY compiler-shim/package.json compiler-shim/

RUN pnpm install --frozen-lockfile || pnpm install

COPY tsconfig.base.json ./
COPY backend/ backend/

RUN pnpm --filter backend build

# Stage 3: Production
FROM node:22-alpine

WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/

RUN pnpm install --prod --filter backend || true

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY --from=backend-build /app/backend/dist /app/backend/dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "backend/dist/server.js"]
