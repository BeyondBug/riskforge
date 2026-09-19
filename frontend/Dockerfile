# RiskForge frontend.
# Build context is the REPOSITORY ROOT (see docker-compose.yml), so that the
# single nginx/nginx.conf can be baked in without duplicating it.
#
#   docker build -f frontend/Dockerfile -t riskforge-frontend .

# ---------- Stage 1: build the React bundle ----------
FROM node:18-alpine AS build

WORKDIR /app

# Manifests first so the dependency layer is cached across source edits.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

# Same-origin by default: Nginx proxies /api, so the bundle needs no absolute
# API host. Overriding this is only necessary if the API moves to another origin.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------- Stage 2: serve the bundle ----------
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# nginx:alpine ships an unprivileged 'nginx' user. Give it ownership of the
# paths the master process writes to, then drop to it.
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
