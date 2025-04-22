#!/bin/bash

# Exit immediately if any command fails
set -e

# Copy all .scss files from src to map to respective directories, or creating that directory if it does not exist
echo "copying dbx-firebase scss files"
cd dist/packages/dbx-firebase/src

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

# go up one directory and copy assets folder from src to access
echo "copying dbx-firebase asset files"
cd ../
mkdir -p src/assets
cp -r src/assets assets

# delete src
echo "cleaning up dbx-firebase scss files"
rm -r src

echo "copying dbx-firebase license"
cd ../../..
cp LICENSE dist/packages/dbx-firebase
