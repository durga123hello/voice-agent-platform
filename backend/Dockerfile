# ==============================================================================
# Stage 1: Build & Dependencies
# ==============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install native compilation toolchain required for mediasoup (C++/Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Clean install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma Client & compile TypeScript to dist/
RUN npx prisma generate
RUN npm run build

# Remove devDependencies to keep final production node_modules lean
RUN npm prune --omit=dev

# ==============================================================================
# Stage 2: Production Runner
# ==============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies: FFmpeg is mandatory for audio transcoding,
# dumb-init for proper PID 1 signal forwarding & graceful shutdowns,
# curl for Docker health checks.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create persistent directories with proper non-root node ownership
RUN mkdir -p /app/uploads /app/logs && chown -R node:node /app

# Copy production runtime artifacts from builder
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma

# Switch to non-root user for security
USER node

# Expose HTTP/WS signaling port and Mediasoup WebRTC RTP port ranges
EXPOSE 3000
EXPOSE 10000-10100/udp
EXPOSE 10000-10100/tcp

# Native Docker Healthcheck against backend health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# dumb-init handles SIGTERM/SIGINT signals properly for graceful Node process termination
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
