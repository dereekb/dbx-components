#!/bin/bash
# Script to merge in the main branch to the latest develop branch.
# If develop has commits after the latest main commit, they are saved
# to a temporary branch and restored after the merge completes.

set -e

TEMP_BRANCH="temp/develop-new-commits"

if [[ `git status --porcelain` ]]; then
  echo "There are changes detected on the current branch. Exiting."
  exit 1
fi

# Clean up any leftover temp branch from a previous run
if git show-ref --verify --quiet refs/heads/$TEMP_BRANCH; then
  echo "Warning: removing leftover temp branch '$TEMP_BRANCH' from a previous run."
  git branch -D $TEMP_BRANCH
fi

echo "Fetching latest from origin..."
git fetch origin

echo "Pulling latest develop branch from origin..."
git pull origin develop

echo "Fetching latest main branch from origin..."
git fetch origin main

# Get the UTC timestamp of the latest commit on origin/main
MAIN_TIMESTAMP=$(git log origin/main -1 --format="%ct")
MAIN_DATE=$(git log origin/main -1 --format="%ci")
echo "Latest main commit timestamp: $MAIN_DATE"

# Find develop commits that are strictly after the latest main commit (by committer date)
# These are new work on develop that should be preserved after the merge.
NEW_COMMITS=$(git log HEAD --format="%H" --after="@$MAIN_TIMESTAMP" --no-merges)

if [[ -n "$NEW_COMMITS" ]]; then
  COMMIT_COUNT=$(echo "$NEW_COMMITS" | wc -l | tr -d ' ')
  echo ""
  echo "Found $COMMIT_COUNT commit(s) on develop after the latest main commit:"
  git log HEAD --oneline --after="@$MAIN_TIMESTAMP" --no-merges
  echo ""

  # Save current HEAD to a temp branch
  echo "Saving new commits to temporary branch '$TEMP_BRANCH'..."
  git branch $TEMP_BRANCH HEAD

  # Find the first commit that is NOT after the main timestamp (i.e., the reset target)
  # This is the most recent commit on develop that is at or before the main commit time.
  RESET_TARGET=$(git log HEAD --format="%H" --before="@$((MAIN_TIMESTAMP + 1))" -1)

  if [[ -z "$RESET_TARGET" ]]; then
    echo "Error: could not find a commit to reset to. Aborting."
    git branch -D $TEMP_BRANCH
    exit 1
  fi

  echo "Resetting develop to $(git log $RESET_TARGET -1 --oneline)..."
  git reset --hard $RESET_TARGET
  echo ""
fi

echo "Merging origin/main into current branch..."
git merge origin/main --no-commit --no-ff

if [[ -n "$NEW_COMMITS" ]]; then
  echo ""
  echo "New develop commits have been saved to '$TEMP_BRANCH'."
  echo "After resolving any merge conflicts, run end-merge-in-main.sh to complete the merge."
  echo "The saved commits will be rebased back on top automatically."
else
  echo ""
  echo "Clean up any merge conflicts and then use end-merge-in-main.sh to complete the merge."
fi
