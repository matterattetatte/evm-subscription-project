
#!/bin/bash
# Base mainnet fork for local testing.

#  comment in if necessary...
kill -9 $(lsof -ti:8545) 2>/dev/null || true

echo "Starting Base mainnet fork (block 39250115)..."


# State from 9th of December 2025. --state makes sure to write state to disk...
anvil \
  --chain-id 8453 \
  --port 8545 \
  --host 0.0.0.0 \
  --mnemonic "test test test test test test test test test test test junk" \
  --accounts 20 \
  --balance 1000000 \
  --auto-impersonate \
  --steps-tracing \
  --disable-code-size-limit \
  --block-base-fee-per-gas 0 \
  -vvvvv