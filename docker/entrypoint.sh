#!/bin/sh
# Apply any pending migrations before the server accepts traffic, then exec the
# real command so the Node process stays PID 1 and receives signals directly.
set -e

echo "[lifeos] applying database migrations"
npx prisma migrate deploy

echo "[lifeos] starting server"
exec "$@"
