#!/bin/bash
echo "Running server in docker container with emulators..."
docker compose run --rm --service-ports demo-api-server npx nx serve demo-api
