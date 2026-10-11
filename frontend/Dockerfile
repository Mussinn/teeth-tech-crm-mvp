# =========================
# 1. Dependencies
# =========================
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


# =========================
# 2. Build
# =========================
FROM node:22-alpine AS builder

WORKDIR /app

# ⭐ ПРИНИМАЕМ ARG ДЛЯ СБОРКИ
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG BACKEND_API_BASE_URL
ARG BACKEND_WS_BASE_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_MVP_WAREHOUSE_ENABLED=false
ARG NEXT_PUBLIC_MVP_FINANCE_ENABLED=false

# ⭐ УСТАНАВЛИВАЕМ ENV ДЛЯ СБОРКИ (чтобы Next.js использовал их при сборке)
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV BACKEND_API_BASE_URL=$BACKEND_API_BASE_URL
ENV BACKEND_WS_BASE_URL=$BACKEND_WS_BASE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE
ENV NEXT_PUBLIC_MVP_WAREHOUSE_ENABLED=$NEXT_PUBLIC_MVP_WAREHOUSE_ENABLED
ENV NEXT_PUBLIC_MVP_FINANCE_ENABLED=$NEXT_PUBLIC_MVP_FINANCE_ENABLED

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# ⭐ Сборка с правильными переменными
RUN npm run build


# =========================
# 3. Production
# =========================
FROM node:22-alpine AS runner

WORKDIR /app

# The deployed server uses node directly. Package installers belong in build stages.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# ⭐ Копируем собранные файлы
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next/cache
USER node

EXPOSE 3000

CMD ["node", "server.js"]
