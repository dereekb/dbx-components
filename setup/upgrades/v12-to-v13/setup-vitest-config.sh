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

# Files to download from the repo root
ROOT_FILES=(
  "vitest.preset.config.mts"
  "vitest.setup.nestjs.ts"
  "vitest.setup.firebase.ts"
  "vitest.setup.angular.ts"
  "vitest.workspace.ts"
)

# Files to download from setup/templates
TEMPLATE_FILES=(
  "vitest.setup.node.ts"
  "vitest.setup.typings.ts"
)

echo "Downloading vitest config files from dbx-components..."
echo ""

for FILE in "${ROOT_FILES[@]}"; do
  echo "Downloading $FILE..."
  curl -fsSL "$BASE_URL/$FILE" -o "$FILE"
  echo "✓ Downloaded $FILE"
done

for FILE in "${TEMPLATE_FILES[@]}"; do
  echo "Downloading $FILE from setup/templates..."
  curl -fsSL "$BASE_URL/setup/templates/$FILE" -o "$FILE"
  echo "✓ Downloaded $FILE"
done

echo ""
echo "==============================================="
echo "✓ Setup complete!"
echo "==============================================="
echo ""
echo "Downloaded files:"
for FILE in "${ROOT_FILES[@]}"; do
  echo "  - $FILE"
done
for FILE in "${TEMPLATE_FILES[@]}"; do
  echo "  - $FILE"
done
echo ""
echo "Next steps:"
echo "  1. Review the downloaded files"
echo "  2. Run the remaining migration steps for each project"
echo "  3. See the migration plan for details"
echo ""
