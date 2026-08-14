#!/bin/bash
echo "Executing the command '$1' with emulators in a Docker instance."

RUN_COMMAND=${1-'echo no command provided.'}
USE_PORTS_ARG=

if [[ "$USE_PORTS" = "true" ]]; then
USE_PORTS_ARG=--service-ports
echo "service ports are being used"
fi

# Nx detects recursive task invocations using a table keyed on (root_pid, task_id), stored in
# the workspace database under .nx/workspace-data -- which is shared with every container via
# the ./:/code bind mount. Container PID namespaces start low and repeat, so a run whose root
# PID matches a row left behind by an earlier container aborts with a false
# "Recursive task invocation detected". Nx prefers NX_INVOCATION_ROOT_PID over process.pid, so
# giving each run a value that cannot collide keeps the invocations distinct.
NX_INVOCATION_ROOT_PID="$$$RANDOM"

docker compose run --rm $USE_PORTS_ARG -e NX_INVOCATION_ROOT_PID="$NX_INVOCATION_ROOT_PID" demo-api-server npx firebase --project=default emulators:exec --only auth,firestore,storage "$RUN_COMMAND"
