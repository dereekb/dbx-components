#!/bin/bash
echo "Running the nginx offline server"
docker compose -f ./docker-compose-nginx-offline.yml run --rm --service-ports dbx-components-offline-server
