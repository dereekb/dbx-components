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

# Live-gated specs (the openrouter blocks, and anything else that skips itself without credentials)
# read their key off the process env, and `docker compose run` starts the container with none of the
# host's. Pass through the ones a spec gates on when the host has them set, so
# `npx env-cmd -f .env.local npx nx test <project>` runs a live block here the same way it does for
# the packages that are not wrapped in docker. Unset variables add nothing, so CI is unaffected.
PASSTHROUGH_ENV_ARGS=()

for VAR_NAME in OPENROUTER_API_KEY OPENROUTER_TEST_MODEL_ID OPENROUTER_FILE_SEARCH_VECTOR_STORE_ID; do
  if [[ -n "${!VAR_NAME}" ]]; then
    PASSTHROUGH_ENV_ARGS+=(-e "$VAR_NAME=${!VAR_NAME}")
  fi
done

docker compose run --rm $USE_PORTS_ARG -e NX_INVOCATION_ROOT_PID="$NX_INVOCATION_ROOT_PID" "${PASSTHROUGH_ENV_ARGS[@]}" demo-api-server npx firebase --project=default emulators:exec --only auth,firestore,storage "$RUN_COMMAND"
