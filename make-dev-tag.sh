#!/bin/bash
# Script to create a tag for the post-dev merge. This is needed for the versioning system to properly use versioning.
TAG=$(git describe --tags $(git rev-list --tags --max-count=1))
git tag "$TAG-dev"
