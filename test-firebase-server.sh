#!/bin/bash
# npx nx run firebase-server:watch
# TEMPORARY: https://github.com/nrwl/nx/issues/8269
./exec-with-emulator.sh 'npx nx run firebase-server:run-tests --watch'
