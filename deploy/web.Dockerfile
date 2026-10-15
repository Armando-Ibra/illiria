# Build context: repository root.  docker build -f deploy/web.Dockerfile .
# One image serves the web app and reverse-proxies /api to the API: same origin, so cookies
# stay SameSite and no CORS is needed. Caddy obtains and renews TLS certificates itself.
FROM node:22-alpine AS build
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /web/dist /srv
