#!/bin/bash
npx nx run-many --exclude=util-test,firebase-test,firebase-server-test --target=lint --fix
