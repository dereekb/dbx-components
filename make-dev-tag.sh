#!/bin/bash
# Script to create a tag for the post-dev merge. This is needed for the versioning system to properly use versioning.
TAG=$(git describe --abbrev=0)
git tag "$TAG-dev"
