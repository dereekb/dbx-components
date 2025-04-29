#!/bin/bash
docker network create -d bridge demo-api-network
npx nx run-many --target=test --all
