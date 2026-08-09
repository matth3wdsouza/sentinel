#!/bin/bash

read -r -p "Optional suffix (e.g. before-hashing-rework, or empty for none): " SUFFIX

if [ -n "$SUFFIX" ]; then
  SUFFIX="-$(printf '%s' "$SUFFIX" | tr -cd 'a-zA-Z0-9-')"
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT="$HOME/Documents/sentinel-backups/$TIMESTAMP-sentinel${SUFFIX}.zip"

mkdir -p "$HOME/Documents/sentinel-backups"

zip -r "$OUTPUT" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".git/*"

echo "Backup created at $OUTPUT"
