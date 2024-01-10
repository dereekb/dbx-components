#!/bin/bash
npx nx run-many --exclude=workspace,util-test,firebase-test,firebase-server-test --target=lint --fix
