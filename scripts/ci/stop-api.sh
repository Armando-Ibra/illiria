#!/usr/bin/env bash
# Stops the API started by start-api.sh (dotnet run spawns the app as a child process).
set -euo pipefail
if [ -f api.pid ]; then
  pkill -P "$(cat api.pid)" || true
  kill "$(cat api.pid)" 2>/dev/null || true
  rm -f api.pid
fi
for _ in $(seq 1 20); do
  curl -sf http://localhost:5080/health/live > /dev/null || exit 0
  sleep 1
done
echo "API is still running." >&2
exit 1
