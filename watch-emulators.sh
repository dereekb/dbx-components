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
echo 'starting server in 5...'
sleep 5
while sleep 2; do
  find dist/apps/demo-api | entr -n -r -s './wait-for-ports.sh && npx env-cmd -f .env.local --use-shell npx firebase --project=default emulators:start --import=/root/data/emulators --export-on-exit'
done
