#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
PROJECT_PARENT_DIR="$(dirname "$PROJECT_DIR")"
CALLER_DIR="$(pwd)"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
DEFAULT_OUTPUT_DIR="$PROJECT_DIR"
FILE_LIST="$(mktemp)"

if [[ $# -gt 0 ]]; then
  if [[ "$1" = /* ]]; then
    OUTPUT_PATH="$1"
  else
    OUTPUT_PATH="$CALLER_DIR/$1"
  fi
else
  OUTPUT_PATH="$DEFAULT_OUTPUT_DIR/${PROJECT_NAME}-${TIMESTAMP}.tar.gz"
fi

cleanup() {
  rm -f "$FILE_LIST"
}

trap cleanup EXIT

mkdir -p "$(dirname "$OUTPUT_PATH")"

cd "$PROJECT_PARENT_DIR"

find "$PROJECT_NAME" \
  \( -type d \( -name node_modules -o -name dist \) -prune \) \
  -o \
  \( -type f -name '*.tar.gz' -prune \) \
  -o \
  -print0 > "$FILE_LIST"

tar \
  --null \
  --no-recursion \
  -czf "$OUTPUT_PATH" \
  -C "$PROJECT_PARENT_DIR" \
  -T "$FILE_LIST"

echo "打包完成: $OUTPUT_PATH"
