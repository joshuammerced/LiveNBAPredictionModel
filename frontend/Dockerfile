# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -g 1001 nextjs && adduser -D -u 1001 -G nextjs nextjs

# output: "standalone" (next.config.ts) bundles the server and only the node_modules it needs.
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs

# Listens on $PORT: 3000 by default, Cloud Run overrides it with 8080.
# Set BACKEND_URL at runtime to point /api/predictions at the backend.
EXPOSE 3000

CMD ["node", "server.js"]
