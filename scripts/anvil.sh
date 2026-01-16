#!/usr/bin/env bash
set -euo pipefail

PORT=8545
RPC_URL="http://127.0.0.1:${PORT}"
echo "Starting anvil"

# Clean up previous instance
if lsof -ti :${PORT} >/dev/null 2>&1; then
  echo "Killing process on port ${PORT}..."
  kill -9 $(lsof -ti :${PORT}) 2>/dev/null || true
  sleep 1
fi

echo "Launching Anvil"

anvil \
  --chain-id 31337 \
  --port ${PORT} \
  --host 0.0.0.0 \
  --auto-impersonate \
  --steps-tracing \
  --disable-code-size-limit \
  --block-base-fee-per-gas 0 \
  -vvvvv
