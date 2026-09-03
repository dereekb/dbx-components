#!/bin/bash
# Performs linting on all projects. Peer dependency syncing is a separate step -- see
# sync-peer-deps.mjs, invoked by start-release.sh.
npx nx run lint-fix-all
