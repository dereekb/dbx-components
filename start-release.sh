#!/bin/bash
# Starts the release process from the develop branch.
if npx git-branch-is develop;
then
echo starting release on develop branch
./force-start-release.sh
else
echo not on the develop branch. switch to the origin develop branch to start release
fi