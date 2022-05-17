#!/bin/bash
# Script to complete merging into main. Will commit 

# template for commit message: merge(release): merge 1.2.0 release
TAG=$(git describe --tags $(git rev-list --tags --max-count=1))
git commit -m "merge(release): merge $TAG release"

# create a new dev tag
sh make-dev-tag.sh
