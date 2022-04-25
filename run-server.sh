#!/bin/bash
echo "Running server in docker container with emulators... This server will not rebuild on changes."
echo "Building demo-api..."
npx nx build demo-api
echo "Running demo-api..."
docker compose run --rm --service-ports demo-api-server npx nx run-emulators demo-api
