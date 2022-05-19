#!/bin/bash
echo "Running server in docker container with emulators with continuous build enabled..."
docker-compose -f ./docker-compose.yml up
