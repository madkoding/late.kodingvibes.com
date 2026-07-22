#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
errors=0

for script in soma_relay_one.sh start_soma_relays.sh; do
    if bash -n "$SCRIPT_DIR/$script" 2>/dev/null; then
        echo "OK: $script (syntax)"
    else
        echo "FAIL: $script (syntax error)"
        errors=$((errors + 1))
    fi
done

# Check that start_soma_relays.sh has all 18 source entries
SOURCES=$(grep -cE '"[a-z0-9]+\s+[a-z0-9]+"' "$SCRIPT_DIR/start_soma_relays.sh" 2>/dev/null || true)
if [ "$SOURCES" -ge 18 ]; then
    echo "OK: start_soma_relays.sh has $SOURCES source entries"
else
    echo "FAIL: start_soma_relays.sh has only $SOURCES source entries (expected >= 18)"
    errors=$((errors + 1))
fi

exit $errors
