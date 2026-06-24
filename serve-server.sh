#!/bin/bash
echo "Running server in docker container with emulators with continuous build enabled..."

# Nx 23's recursive-task-invocation guard inserts a (root_pid, task_id) row -- with a
# UNIQUE primary key -- into the SQLite db under .nx/workspace-data/. That dir is
# bind-mounted into the container (./:/code), so the db survives `docker compose run
# --rm`. Inside a fresh container `nx` deterministically gets PID 20, and `--rm`
# SIGKILLs the process before Nx can run its cleanup, leaving a stale (20, ...:serve)
# row behind. Nx only purges stale rows older than a day, so the next `serve-server.sh`
# within 24h re-registers (20, ...:serve), hits the PK collision, and aborts with a
# false "recursive loop of task invocations" error.
#
# Passing a unique root PID per run sidesteps the cross-run PID-reuse collision while
# leaving genuine in-run recursion detection intact (child tasks inherit this value).
# Epoch seconds stay within the table's 32-bit root_pid column and well above any
# container PID.
export NX_INVOCATION_ROOT_PID="$(date +%s)"

docker compose run --rm --name=demo-api-server --service-ports \
  -e NX_INVOCATION_ROOT_PID \
  demo-api-server npx nx serve demo-api
