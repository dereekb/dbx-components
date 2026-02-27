#!/bin/bash

set -e

echo "==============================================="
echo "Vitest Migration: Steps 1 & 2"
echo "Downloading vitest setup files and shared config"
echo "==============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Working directory: $SCRIPT_DIR"
echo ""

BASE_URL="https://raw.githubusercontent.com/dereekb/dbx-components/develop"

# List of files to download
FILES=(
  "vitest.preset.config.mts"
  "vitest.setup.node.ts"
  "vitest.setup.nestjs.ts"
  "vitest.setup.firebase.ts"
  "vitest.setup.angular.ts"
  "vitest.setup.typings.ts"
  "vitest.workspace.ts"
)

echo "Downloading vitest config files from dbx-components..."
echo ""

for FILE in "${FILES[@]}"; do
  echo "Downloading $FILE..."
  curl -fsSL "$BASE_URL/$FILE" -o "$FILE"
  echo "✓ Downloaded $FILE"
done

echo ""
echo "==============================================="
echo "✓ Setup complete!"
echo "==============================================="
echo ""
echo "Downloaded files:"
for FILE in "${FILES[@]}"; do
  echo "  - $FILE"
done
echo ""
echo "Next steps:"
echo "  1. Review the downloaded files"
echo "  2. Run the remaining migration steps for each project"
echo "  3. See the migration plan for details"
echo ""
