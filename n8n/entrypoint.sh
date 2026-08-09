#!/bin/sh
set -e

# Railway injects PORT — n8n listens on N8N_PORT
export N8N_PORT="${PORT:-${N8N_PORT:-5678}}"
export N8N_LISTEN_ADDRESS="0.0.0.0"

mkdir -p /home/node/.n8n

# Import mock workflow once per data volume (skips if already imported)
if [ ! -f /home/node/.n8n/.golkhune_imported ]; then
  echo "[golkhune] Importing mock workflows..."
  for f in /home/node/workflows/*.json; do
    [ -f "$f" ] || continue
    n8n import:workflow --input="$f" || echo "[golkhune] import warning for $f"
  done
  touch /home/node/.n8n/.golkhune_imported
  echo "[golkhune] Import done. Activate the workflow in the UI if needed."
fi

echo "[golkhune] Starting n8n on port ${N8N_PORT}..."
exec n8n start
