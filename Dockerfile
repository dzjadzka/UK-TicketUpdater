# Multi-stage build to produce a slim runtime image
FROM node:18-alpine AS builder
WORKDIR /app

# Backend deps
COPY package*.json ./
RUN npm ci --omit=dev

# Frontend deps and build
COPY frontend/package*.json frontend/
COPY frontend/src frontend/src
COPY frontend/public frontend/public
COPY frontend/index.html frontend/
COPY frontend/vite.config.js frontend/
COPY frontend/postcss.config.js frontend/
COPY frontend/tailwind.config.js frontend/
COPY frontend/eslint.config.js frontend/
RUN cd frontend && npm ci && npm run build

# Copy source
COPY src src
COPY docs docs
COPY scripts scripts
COPY README.md README.md

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/src src
COPY --from=builder /app/docs docs
COPY --from=builder /app/scripts scripts
COPY --from=builder /app/frontend/dist frontend/dist
COPY --from=builder /app/README.md README.md

RUN mkdir -p data downloads config

EXPOSE 3000
CMD ["node", "scripts/docker-entrypoint.js"]
