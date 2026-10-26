#!/usr/bin/env bash
#
# Snapshot the working tree into ~/Documents/sentinel-backups.
#
# Usage:
#   ./backup.sh                    prompt for an optional suffix
#   ./backup.sh pre-talk           non-interactive, suffix "pre-talk"
#
# node_modules, .next, .git, out, .wrangler, __pycache__, .venv and .DS_Store
# are pruned at ANY depth. The old zip -x patterns were anchored to the repo
# root, so docs/internal/showcase/node_modules slipped through.

set -euo pipefail

SUFFIX=""

if [ "$#" -gt 0 ]; then
  SUFFIX_RAW="$1"
elif [ -t 0 ]; then
  read -r -p "Optional suffix (e.g. before-hashing-rework, or empty for none): " SUFFIX_RAW
else
  SUFFIX_RAW=""
fi

if [ -n "${SUFFIX_RAW:-}" ]; then
  CLEAN=$(printf '%s' "$SUFFIX_RAW" | tr -cd 'a-zA-Z0-9-')
  if [ -n "$CLEAN" ]; then
    SUFFIX="-$CLEAN"
  fi
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEST="$HOME/Documents/sentinel-backups"
OUTPUT="$DEST/$TIMESTAMP-sentinel${SUFFIX}.zip"

mkdir -p "$DEST"

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$ROOT"

LIST=$(mktemp)
trap 'rm -f "$LIST"' EXIT

# -prune stops find descending into generated or vendored directories, at any
# depth, so docs/internal/showcase/node_modules is excluded as well as the root
# one. Only regular files are listed, so empty directories are not archived.
find . \
  \( -name node_modules \
     -o -name .next \
     -o -name .git \
     -o -name out \
     -o -name .wrangler \
     -o -name __pycache__ \
     -o -name .venv \
     -o -name .DS_Store \) -prune \
  -o -type f -print \
  | sed 's|^\./||' \
  | sort > "$LIST"

if [ ! -s "$LIST" ]; then
  echo "Nothing to back up." >&2
  exit 1
fi

# zip -@ takes the file list from stdin, which avoids pattern-matching surprises.
zip -q "$OUTPUT" -@ < "$LIST"

COUNT=$(wc -l < "$LIST" | tr -d ' ')
SIZE=$(du -h "$OUTPUT" | cut -f1)

# Safety net: the archive must not contain any node_modules entry. If it does,
# the exclusions above have regressed and the backup is not what was promised.
if zip -l "$OUTPUT" | grep -q "node_modules"; then
  echo "ERROR: $OUTPUT contains node_modules entries. Exclusions failed." >&2
  exit 1
fi

echo "Backup created at $OUTPUT"
echo "  $COUNT files, $SIZE"
echo "  excluded: node_modules, .next, .git, out, .wrangler, __pycache__, .venv"
