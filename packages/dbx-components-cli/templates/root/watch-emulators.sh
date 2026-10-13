#!/bin/bash
# Rebuild-and-restart loop for the Firebase emulators.
#
# Extracted from the `demo-api:watch-emulators` nx target so `demo-api:serve` can run it WITHOUT
# shelling out to a nested `npx nx`. A nested `npx nx run demo-api:watch-emulators` inherits
# NX_INVOCATION_ROOT_PID from the serve task, so the child process sees demo-api:serve already
# registered under that root and blocks on "Waiting for demo-api:serve in another nx process" --
# serve waits for the emulators, the emulators wait for serve, and nothing ever starts.
#
# The emulator suite does not hot-reload functions, so entr restarts it whenever the built output
# under dist/apps/demo-api changes.
#
# Usage: watch-emulators.sh [<project>:<target>]
#
# The argument names the continuous task that rebuilds dist/apps/demo-api -- `serve` passes
# demo-api:build-watch. Nx keeps serve running after a continuous dependency exits (it only prints
# `Task "demo-api:build-watch" is continuous but exited with code 1`), which left the emulators
# serving a dist that never rebuilt, with nothing louder in the log. With the argument, a watchdog
# stops the container when that task's process goes away, so the failure shows as a server that is
# down rather than one that is quietly stale.
SUPERVISED_TASK="$1"
SUPERVISED_PROJECT="${SUPERVISED_TASK%%:*}"
SUPERVISED_TARGET="${SUPERVISED_TASK#*:}"
SUPERVISED_TARGET="${SUPERVISED_TARGET%%:*}"

# Succeeds when the pid is one of the supervised task's processes. Nx sets NX_TASK_TARGET_PROJECT and
# NX_TASK_TARGET_TARGET in the environment of every executor task it forks, with or without a TTY;
# serve itself runs from the main nx process and its children carry its own target, so nothing serve
# starts can match.
isSupervisedTaskProcess() {
  grep -qzxF "NX_TASK_TARGET_PROJECT=$SUPERVISED_PROJECT" "/proc/$1/environ" 2>/dev/null &&
    grep -qzxF "NX_TASK_TARGET_TARGET=$SUPERVISED_TARGET" "/proc/$1/environ" 2>/dev/null
}

findSupervisedTaskPids() {
  local pid
  for pid in /proc/[0-9]*; do
    pid="${pid#/proc/}"
    isSupervisedTaskProcess "$pid" && echo "$pid"
  done
}

# Re-reading the environment instead of `kill -0` keeps a recycled pid from passing for the task.
isSupervisedTaskAlive() {
  local pid
  for pid in "$@"; do
    isSupervisedTaskProcess "$pid" && return 0
  done
  return 1
}

superviseTask() {
  local -a pids=()

  # serve only starts once the task's process has been forked, so this normally succeeds at once.
  for _ in {1..60}; do
    mapfile -t pids < <(findSupervisedTaskPids)
    [[ ${#pids[@]} -gt 0 ]] && break
    sleep 2
  done

  if [[ ${#pids[@]} -eq 0 ]]; then
    echo "WARNING: watch-emulators.sh found no $SUPERVISED_TASK process to supervise. If the rebuild leg dies, this server will keep serving a stale dist/apps/demo-api." >&2
    return
  fi

  while isSupervisedTaskAlive "${pids[@]}"; do
    sleep 5
  done

  echo >&2
  echo "=====================================================================================" >&2
  echo "  $SUPERVISED_TASK exited -- dist/apps/demo-api will no longer rebuild." >&2
  echo "  Stopping the container instead of serving stale code. Start it again with" >&2
  echo "  ./serve-server.sh or the dbx-claude-docker \`serve\` action." >&2
  echo "=====================================================================================" >&2

  # PID 1 is the container's `npx nx` process, and SIGTERM is what `docker stop` sends it: npm forwards
  # it and exits, which takes the container down with everything in it. Never outside a container --
  # there PID 1 is the machine's init.
  if [[ -f /.dockerenv || -f /run/.containerenv ]]; then
    kill -TERM 1
  fi
}

if [[ "$SUPERVISED_TASK" == *:* ]]; then
  superviseTask &
fi

echo 'starting server in 5...'
sleep 5
while sleep 2; do
  find dist/apps/demo-api | entr -n -r -s './wait-for-ports.sh && npx env-cmd -f .env.local --use-shell npx firebase --project=default emulators:start --import=/root/data/emulators --export-on-exit'
done
