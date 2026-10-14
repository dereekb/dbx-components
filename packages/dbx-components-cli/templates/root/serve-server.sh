#!/bin/bash
# Everything below runs from the repo root (docker compose, nx and dbx-claude all resolve this checkout from
# the working directory), so switch to this script's own directory wherever it was invoked from.
cd "$(dirname "$0")" || exit 1

# With dbx-claude installed and this repo configured for it (.dbx-claude/dbx-claude.json
# `capabilityConfig.docker.options.serve`), hand off to `dbx-claude serve server`. It binds to a server that is
# already running (started by an agent, another terminal or by hand) instead of colliding on the container
# name, follows its output until Ctrl+C (which stops the server), runs `serve.preLaunch` (the Nx reset below)
# before every launch, and with `serve.supervise` restarts the container when demo-api:build-watch dies.
# Arguments are forwarded (--build, --watch, --restart). Set DBX_CLAUDE_SERVE=0 to use the plain docker path.
if [ "${DBX_CLAUDE_SERVE:-}" != "0" ] && [ -f .dbx-claude/dbx-claude.json ] && command -v dbx-claude > /dev/null 2>&1; then
  echo "Delegating to \`dbx-claude serve server\` (Ctrl+C stops the server; with --watch it only detaches)..."
  exec dbx-claude serve server "$@"
fi

# A server that is already running (started by dbx-claude, another terminal or by hand) holds the container
# name and the published ports, and the `nx reset` below would wipe the Nx task state out from under it. Stop
# here instead of resetting.
if [ -n "$(docker ps --filter 'name=^demo-api-server$' --format '{{.Names}}' 2> /dev/null)" ]; then
  echo "A demo-api-server container is already running; not starting another one."
  echo "Follow it with \`docker logs -f demo-api-server\` or stop it with \`docker stop demo-api-server\`."
  exit 1
fi

echo "Running server in docker container with emulators with continuous build enabled..."

# Started this way the server is unsupervised: if demo-api:build-watch dies, Nx keeps serve running on a
# dist that never rebuilds. `dbx-claude serve server` (configured in .dbx-claude/dbx-claude.json) watches
# that task and rebuilds on the host and restarts the container when it dies.
echo "Note: this server is UNSUPERVISED -- if demo-api:build-watch dies it keeps serving a stale build."
echo "      \`dbx-claude serve server\` is the supervised replacement; this script uses it when dbx-claude is installed."

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
