#!/bin/bash
echo "Running server in docker container with emulators with continuous build enabled..."

# No command: the service's own `command:` (serve-in-container.sh) starts the server with Nx state
# private to the container. So there is no shared .nx/workspace-data to reset first, and no
# NX_INVOCATION_ROOT_PID to pass -- the task DB that guard protects is created fresh in the container.
docker compose run --rm --name=demo-api-server --service-ports demo-api-server
