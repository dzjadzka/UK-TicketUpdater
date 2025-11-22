# Multi-stage build to produce a slim runtime image
FROM node:18-alpine AS builder
WORKDIR /app

# Backend deps
COPY package*.json ./
RUN npm ci --omit=dev

# Frontend deps and build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci && npm run build

# Copy source
COPY src src
COPY config config
COPY docs docs
COPY frontend/dist frontend/dist
COPY README.md README.md

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/src src
COPY --from=builder /app/config config
COPY --from=builder /app/docs docs
COPY --from=builder /app/frontend/dist frontend/dist
COPY --from=builder /app/README.md README.md

RUN mkdir -p data downloads

EXPOSE 3000
CMD ["node", "src/server.js"]
