#!/bin/sh
set -e

echo "[start] Iniciando nginx..."
nginx

echo "[start] Iniciando backend Node.js..."
exec node /app/backend/src/app.js
