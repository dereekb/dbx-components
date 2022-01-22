#!/bin/bash
# Remove the docker image created from ./serve.sh
docker-compose -f docker-compose.yml down --remove-orphans
