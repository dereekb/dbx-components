#!/bin/bash
# Starts the release process on the current branch. Call "npx nx start-release" to start a new release on the

if [[ `git status --porcelain` ]]; then
  echo there are changes detected on the current branch. exiting.
  exit 1
fi

if git show-ref --quiet refs/remotes/origin/release;
then
  echo 'deleting existing release branch from origin...'
  git push origin --delete release -q
  echo 'deleted existing release branch from origin'
fi

if git show-ref --quiet refs/heads/release;
then
  echo 'deleting existing local release branch...'
  git branch -D release -q
  echo 'deleted existing local release branch'
fi

echo 'starting release'
echo 'pulling latest develop branch'
git checkout origin/develop -q
echo 'pushing release to origin'
git branch release -q
git push origin release -q
echo 'release pushed to origin'
git branch -d release
echo 'cleaned up release branch'
git checkout develop
