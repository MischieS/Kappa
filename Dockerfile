FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SQLITE_DB_PATH=/app/data/tarkov-tracker.db
ENV REF_CACHE_DIR=/app/data/ref-cache

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
RUN mkdir -p /app/data /app/data/ref-cache && chown -R nextjs:nextjs /app/data
COPY --from=builder --chown=nextjs:nextjs /app/package*.json ./
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules

RUN mkdir -p /app/.next/cache && chown -R nextjs:nextjs /app/.next

USER nextjs

EXPOSE 3000
CMD ["npm","run","start"]
