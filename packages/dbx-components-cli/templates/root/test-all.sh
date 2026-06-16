#!/bin/bash
docker network create -d bridge demo-api-network
npx nx run-many -t test --all
