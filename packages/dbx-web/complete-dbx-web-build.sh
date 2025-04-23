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
