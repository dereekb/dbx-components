#!/bin/bash

# Exit immediately if any command fails
set -e

# Copy all .scss files from src to map to respective directories, or creating that directory if it does not exist
echo "copying dbx-web scss files"
cd dist/packages/dbx-web/src

# Find and copy each .scss file, while echoing the action
find * -type f -name "*.scss" -exec sh -c '
  for filepath; do
    dest_dir="../$(dirname "$filepath")"
    dest_path="../$filepath"
    mkdir -p "$dest_dir"
    cp "$filepath" "$dest_path"
    echo "Copied src/$filepath to $dest_path"
  done
' sh {} +

# go up one directory and delete src
echo "cleaning up dbx-web scss files"
cd ..
rm -r src

echo "copying dbx-web license"
cd ../../..
cp LICENSE dist/packages/dbx-web

# ng-packagr writes a `.npmignore` that excludes ALL nested package.json files.
# The rollup-built eslint subpath needs its own to ship: it carries that entry
# point's `peerDependencies` and its `"type": "module"` declaration, which is
# what makes `eslint/index.esm.js` an unambiguous ES module for Node.
# Whitelist `eslint/package.json` so it ships in the npm tarball.
echo "preserving dbx-web/eslint/package.json in npm publish"
NPMIGNORE_FILE=dist/packages/dbx-web/.npmignore
if ! grep -q '^!eslint/package.json$' "$NPMIGNORE_FILE"; then
  printf '\n!eslint/package.json\n' >> "$NPMIGNORE_FILE"
fi
