# Agora - Nuxt 3 Application Dockerfile
# Multi-stage build for optimal production image

# =====================================
# Stage 1: Builder (needs all deps for build)
# =====================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev) for build
RUN npm install && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
ENV NODE_ENV=production
RUN npm run build

# =====================================
# Stage 2: Production Runner
# =====================================
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxt

# Set production environment
ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Copy built application (output is self-contained)
COPY --from=builder --chown=nuxt:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxt:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nuxt:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Switch to non-root user
USER nuxt

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", ".output/server/index.mjs"]
