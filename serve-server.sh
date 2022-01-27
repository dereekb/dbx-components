#!/bin/bash
echo "Running server in docker container with emulators..."
docker-compose run --rm -v --service-ports demo-api-server nx serve demo-api
