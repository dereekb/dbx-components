#!/bin/bash
# Starts the release process from the develop branch.
if npx git-branch-is develop;
then

# check if there are any current changes. If so, exit.
if [[ `git status --porcelain` ]]; then
  echo there are changes detected on the current branch. exiting.
  exit 1
fi

echo running lint-fix before starting release
./lint-fix-all.sh

# if has changes then create a commit for the lint fix
if [[ `git status --porcelain` ]]; then
  echo lint-fix created changes. Comitting to git.
  git commit --no-verify -a -m "build: lint fix"
  git push origin develop
fi

echo starting release on develop branch
./force-start-release.sh
else
echo not on the develop branch. switch to the origin develop branch to start release
fi