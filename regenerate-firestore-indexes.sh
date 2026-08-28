#!/bin/bash
# Regenerates the workspace firestore.indexes.json from @dbxModelFirebaseIndex
# factories in packages/firebase, packages/openrouter/firebase, and
# components/demo-firebase. Firebase deploys one indexes file per database, so
# every package contributing indexes must be listed on the regenerate target.
npx nx run dbx-cli-generate-firestore-indexes:regenerate
