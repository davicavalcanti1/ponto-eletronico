# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Install backend deps ────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /build
COPY backend/package*.json ./
RUN npm ci --production

# ── Stage 3: Final image ──────────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache nginx

# nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Frontend static files
COPY --from=frontend-builder /build/dist /usr/share/nginx/html

# Backend
WORKDIR /app/backend
COPY --from=backend-builder /build/node_modules ./node_modules
COPY backend/src ./src

# Startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
