#!/bin/bash
# Native Messaging Host launcher for macOS/Linux
# Invoked by Chrome via native messaging manifest
DIR="$(cd "$(dirname "$0")" && pwd)"
exec python3 "$DIR/host.py" "$@"
