#!/bin/bash
echo "Executing the command '$@' with emulators in a Docker instance."
docker compose run --rm demo-api-server npx firebase emulators:exec --only auth,firestore,storage "$@"
