#!/bin/bash
# npx nx run dbx-firebase:watch
# TEMPORARY: https://github.com/nrwl/nx/issues/8269
./exec-with-emulator.sh 'npx nx run demo-api:run-tests --watch'
