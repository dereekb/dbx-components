#!/bin/bash
# Regenerates the workspace firestore.indexes.json from @dbxModelFirebaseIndex
# factories in components/demo-firebase.
npx nx run dbx-cli-generate-firestore-indexes:regenerate
