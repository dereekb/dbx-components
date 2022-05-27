#!/bin/bash
echo "Executing the command '$1' with emulators in a Docker instance."

RUN_COMMAND=${1-'echo no command provided.'}
USE_PORTS_ARG=

if [ "$USE_PORTS" = "true" ]; then
USE_PORTS_ARG=--service-ports
echo "service ports are being used"
fi

docker compose run --rm $USE_PORTS_ARG demo-api-server npx firebase --project=default emulators:exec --only auth,firestore,storage "$RUN_COMMAND"
