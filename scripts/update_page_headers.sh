#!/bin/bash
# Script to help identify page structures for modernization
echo "Checking page structures..."

for page in AudioTelephony Transcripts Privacy Observability System; do
  file="/app/frontend/src/pages/${page}/index.jsx"
  if [ -f "$file" ]; then
    echo "\n=== ${page} Page ==="
    grep -n "Container maxWidth" "$file" || echo "No Container found"
    grep -n "<Tabs" "$file" || echo "No Tabs found"
  fi
done
