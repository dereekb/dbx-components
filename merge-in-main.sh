#!/bin/bash
# Script to merge in the main branch to the latest develop branch. Conflicts must be manually handled.
if [[ `git status --porcelain` ]]; then
  echo there are changes detected on the current branch. exiting.
  exit 1
fi

echo checking out latest develop branch from origin
git pull origin develop
git checkout origin/develop
echo merging origin/main into develop
git pull origin main
git merge origin/main --no-commit -m "merge(release): merge ${$(git describe --abbrev=0)} release"

# template for commit message: merge(release): merge 1.2.0 release
