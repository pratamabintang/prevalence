# ==========================================
# Tahap 1: Build Frontend Angular SPA
# ==========================================
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ==========================================
# Tahap 2: Build Backend Node.js
# ==========================================
FROM node:24-alpine AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ==========================================
# Tahap 3: Runtime Terpadu (Nginx + Node.js)
# ==========================================
FROM node:24-alpine AS runtime

# Instal Nginx di Alpine Linux
RUN apk add --no-cache nginx

WORKDIR /app

# Salin hasil kompilasi frontend ke direktori web Nginx
COPY --from=frontend-builder /app/dist/dinkes/browser /usr/share/nginx/html

# Salin backend server dan dependensi produksi
COPY --from=backend-builder /app/server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY --from=backend-builder /app/server/dist ./server/dist

# Salin konfigurasi Nginx dan entrypoint
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Volume persisten untuk database SQLite (/data/dinkes.db) dan berkas uploads (/data/uploads)
VOLUME ["/data"]

# Port standar HTTP
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
