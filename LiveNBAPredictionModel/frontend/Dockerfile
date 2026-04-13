# syntax=docker/dockerfile:1

FROM node:20-alpine as builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/src/package*.json ./
COPY --from=builder /app/src/.next ./.next
COPY --from=builder /app/src/public ./public
COPY --from=builder /app/src/next.config.ts ./

RUN npm ci --omit=dev

RUN addgroup -g 1001 nextjs && adduser -D -u 1001 -G nextjs nextjs
USER nextjs

EXPOSE 8080

CMD ["npm", "start", "--", "-p", "8080"]
