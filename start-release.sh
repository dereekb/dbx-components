#!/bin/bash
# Starts the release process from the develop branch.
if npx git-branch-is develop;
then

# check if there are any current changes. If so, exit.
if [[ `git status --porcelain` ]]; then
  echo there are changes detected on the current branch. exiting.
  exit 1
fi

echo regenerating dbx-components-mcp files before starting release
./regenerate-dbx-components-mcp.sh

echo regenerating firestore.indexes.json before starting release
./regenerate-firestore-indexes.sh

# Postinstall runs this with --skip-internal so it never fights nx release, which owns the
# @dereekb/* pins. Nx release can only bump a dep it sees as a WORKSPACE project, and it only
# sees one whose declared version already matches -- so a pin that drifts drops out of the
# graph and is then frozen forever. Syncing here, on a clean develop tree before the release
# branch is cut, hands those pins back to nx release so it can bump them with everything else.
echo syncing internal peer dependency versions before starting release
node tools/scripts/sync-peer-deps.mjs || exit 1

echo running lint-fix before starting release
./lint-fix-all.sh

# if has changes then create a commit for the regeneration/sync/lint-fix steps above
if [[ `git status --porcelain` ]]; then
  echo release prep created changes. Comitting to git.
  git commit --no-verify -a -m "build: lint fix + mcp regeneration + firestore indexes + peer dep sync"
  git push origin develop
fi

echo starting release on develop branch
./force-start-release.sh
else
echo not on the develop branch. switch to the origin develop branch to start release
fi