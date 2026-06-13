#!/bin/bash
# Script to complete merging into main. Will commit and create dev tag.
# If start-merge-in-main.sh saved commits to a temp branch, this script
# leaves that branch intact for manual rebasing afterward.

TEMP_BRANCH="temp/develop-new-commits"

# template for commit message: merge(release): merge 1.2.0 release
TAG=$(git describe --tags $(git rev-list --tags --max-count=1))
git commit -m "merge(release): merge $TAG release"

# create a new dev tag
sh make-dev-tag.sh

# Notify if there are saved commits to rebase
if git show-ref --verify --quiet refs/heads/$TEMP_BRANCH; then
  echo ""
  echo "NOTE: Saved develop commits exist on '$TEMP_BRANCH'."
  echo "Rebase them onto develop to include them in the next release:"
  echo "  git rebase develop $TEMP_BRANCH && git checkout develop && git merge --ff-only $TEMP_BRANCH && git branch -d $TEMP_BRANCH"
fi
