#!/bin/sh
set -e

# Pastikan direktori data persisten dan uploads tersedia
mkdir -p /data/uploads

echo "[Dinkes Container] Menyiapkan volume persisten di /data..."

# Jalankan Backend API Server di latar belakang
export PORT=3000
export DB_PATH=/data/dinkes.db
export UPLOADS_DIR=/data/uploads
export NODE_ENV=production

echo "[Dinkes Container] Menjalankan Node.js Backend Server pada port 3000..."
node /app/server/dist/index.js &
BACKEND_PID=$!

# Tunggu backend startup
sleep 1

# Tangani sinyal penghentian kontainer (graceful shutdown)
cleanup() {
    echo "[Dinkes Container] Menghentikan proses layanan..."
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

echo "[Dinkes Container] Menjalankan Nginx Reverse Proxy pada port 80..."
nginx -g 'daemon off;' &
NGINX_PID=$!

# Tunggu salah satu proses selesai
wait -n "$BACKEND_PID" "$NGINX_PID"
