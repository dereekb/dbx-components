#!/bin/bash
echo "Executing the command '$1' with emulators in a Docker instance."

RUN_COMMAND=${1-'echo no command provided.'}
USE_PORTS_ARG=

if [[ "$USE_PORTS" = "true" ]]; then
USE_PORTS_ARG=--service-ports
echo "service ports are being used"
fi

# Nx keys its recursive-task-invocation guard on (root_pid, task_id) rows in the SQLite db under
# .nx/workspace-data/, which is bind-mounted into the container via ./:/code and therefore shared
# across container runs. Container PID namespaces start low and repeat, so a run whose root PID
# matches a row left behind by an earlier container aborts with a false "Recursive task invocation
# detected". Nx prefers NX_INVOCATION_ROOT_PID over process.pid, so give each run a value that
# cannot collide. It must stay under 2^31 -- the root_pid column is 32-bit and Nx does Number(...)
# on it -- so this is (epoch seconds mod 1e7) * 100 + (pid mod 100): unique per second per process,
# max 999,999,999. POSIX sh arithmetic, no bashisms.
NX_INVOCATION_ROOT_PID="$(( ($(date +%s) % 10000000) * 100 + $$ % 100 ))"

docker compose run --rm $USE_PORTS_ARG -e NX_INVOCATION_ROOT_PID="$NX_INVOCATION_ROOT_PID" demo-api-server npx firebase --project=default emulators:exec --only auth,firestore,storage "$RUN_COMMAND"
