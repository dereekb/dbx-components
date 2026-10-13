#!/bin/bash
echo "Running server in docker container with emulators with continuous build enabled..."

# Nx keys its recursive-task-invocation guard on (root_pid, task_id) rows in the SQLite db under
# .nx/workspace-data/, which is bind-mounted into the container via ./:/code and therefore shared
# across container runs. Container PID namespaces start low and repeat, so a run whose root PID
# matches a row left behind by an earlier container aborts with a false "Recursive task invocation
# detected". Nx prefers NX_INVOCATION_ROOT_PID over process.pid, so give each run a value that
# cannot collide. It must stay under 2^31 -- the root_pid column is 32-bit and Nx does Number(...)
# on it -- so this is (epoch seconds mod 1e7) * 100 + (pid mod 100): unique per second per process,
# max 999,999,999. POSIX sh arithmetic, no bashisms.
NX_INVOCATION_ROOT_PID="$(( ($(date +%s) % 10000000) * 100 + $$ % 100 ))"
export NX_INVOCATION_ROOT_PID

# Clear stale task state before starting.
#
# Nx records running tasks (and task invocations) in the SQLite db under .nx/workspace-data/. Since
# nx.json pins `cacheDirectory` to .nx/cache, that db lives inside the checkout and is therefore
# bind-mounted into the container -- which is what lets the container reuse the host's build cache.
# The cost is that the db now OUTLIVES the container: `docker compose run --rm` (and ./down.sh)
# SIGKILL the process, so Nx never runs its cleanup and rows for demo-api:serve / demo-api:build-watch
# are left behind. The next run then blocks forever on "Waiting for demo-api:serve in another nx
# process". Before `cacheDirectory` was pinned the db sat at /root/.nx inside the container and died
# with it, so this never surfaced.
#
# --onlyWorkspaceData clears the db and the project-graph metadata but NOT .nx/cache, so the shared
# build cache survives; the graph is recomputed once on the next command.
npx nx reset --onlyWorkspaceData > /dev/null 2>&1

docker compose run --rm --name=demo-api-server --service-ports \
  -e NX_INVOCATION_ROOT_PID \
  demo-api-server npx nx serve demo-api
