#!/bin/bash
# Performs linting on all projects. This process also updates the peer dependencies of all nested package.json files.
npx nx run-many --exclude=workspace,util-test,firebase-test,firebase-server-test --target=lint --fix
