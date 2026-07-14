#!/usr/bin/env bash
# Creates the kb_chunks vector search index in Atlas (spec §2.6).
# Requires the Atlas CLI, authenticated, with a project selected.
#   Usage: ./create-atlas-index.sh <clusterName>
set -euo pipefail
CLUSTER="${1:?Usage: create-atlas-index.sh <clusterName>}"
DIR="$(cd "$(dirname "$0")" && pwd)"

atlas clusters search indexes create \
  --clusterName "$CLUSTER" \
  --file "$DIR/atlas-vector-index.json"

echo "Submitted kb_chunks_vector index for cluster $CLUSTER."
