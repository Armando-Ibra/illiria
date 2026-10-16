#!/usr/bin/env bash
# Starts the API in the background (launch profile: http://localhost:5080, Development) and waits until it's live.
set -euo pipefail
nohup dotnet run --project src/Illiria.Api --no-build > api.log 2>&1 &
echo $! > api.pid
for _ in $(seq 1 60); do
  if curl -sf http://localhost:5080/health/ready > /dev/null; then
    echo "API is up."
    exit 0
  fi
  sleep 1
done
echo "API did not start:" >&2
cat api.log >&2
exit 1
