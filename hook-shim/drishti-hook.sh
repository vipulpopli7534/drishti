#!/usr/bin/env bash
# Forwards the hook's stdin JSON payload as-is to the Drishti daemon.
# Must never block the session or fail the hook: short timeout, always exit 0.
curl -s -m 0.4 -d @- http://127.0.0.1:4317/event >/dev/null 2>&1 || true
exit 0
