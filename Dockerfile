FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_progress=false \
    npm_config_update_notifier=false \
    npm_config_fetch_timeout=120000 \
    npm_config_fetch_retry_maxtimeout=120000
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --progress=false --loglevel=warn

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_ROOT=/data/documents \
    MARKITDOWN_BIN=/usr/local/bin/markitdown

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
 && pip3 install --no-cache-dir --break-system-packages 'markitdown[pdf]==0.1.6' \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && mkdir -p /data/documents \
 && chown -R nextjs:nodejs /data/documents

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/import-d1-backup.mjs ./scripts/import-d1-backup.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/import-users.mjs ./scripts/import-users.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-admin.mjs ./scripts/seed-admin.mjs

USER nextjs
EXPOSE 3000
VOLUME ["/data/documents"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
