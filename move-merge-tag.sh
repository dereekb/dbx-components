#!/bin/bash
# Script to move the merge tag to the current branch.
git tag -f 'latest-merge'
echo moved '"latest-merge"' tag to current commit
