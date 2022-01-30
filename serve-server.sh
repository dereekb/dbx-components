#!/bin/bash
echo "Running server in docker container with emulators..."
docker compose run --rm -v --service-ports demo-api-server npx nx serve demo-api
