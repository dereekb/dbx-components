#!/bin/bash
# The demo-api-server container's dev-server entry point -- docker-compose.yml's `command:`, so
# ./serve-server.sh, `docker compose up demo-api-server` and the dbx-claude-docker `serve` action all
# start here. Not for the host.
#
# It runs `nx serve` with Nx state of its own instead of the checkout's. Nx keeps its daemon's identity
# file at .nx/workspace-data/d/server-process.json -- inside the ./:/code bind mount, so the host and
# every container of this service share it (nx.json's pinned `cacheDirectory` puts the task DB there
# too). Each daemon re-reads that file every 20ms and shuts itself down once it names another process
# ("this process is no longer the current daemon"), so any host nx command or exec-with-emulator.sh
# container that started a daemon evicted this container's. demo-api:build-watch holds daemon file
# watchers (@nx/js copyAssets and copyPackageJson in watch mode), and after an eviction they only retry
# the socket the shared file now names -- a host path or another container's /tmp, never reachable
# from here -- until they log "Failed to reconnect to daemon after multiple attempts" and exit(1). Nx
# kept serve running without its watch leg, so the emulators served a dist that never rebuilt.
#
# NX_WORKSPACE_DATA_DIRECTORY moves the daemon files, the task DB and the daemon's `disabled` marker
# into the container, where nothing outside it can reach them. NX_CACHE_DIRECTORY moves the cache with
# them: the DB indexes the cache, so a private DB could never hit the shared .nx/cache, and writing
# there would only strand artifacts no DB references. Test containers keep the shared cache and DB --
# cross-container cache reuse is for them. A `docker exec` shell does not inherit these exports; export
# the same two variables there to talk to serve's daemon.
#
# Cleared on every start. `docker compose run --rm` starts from a fresh container anyway, but one
# restarted in place (`docker compose up` / `restart`) keeps /tmp, and a killed run's running-task rows
# would block the next start on "Waiting for demo-api:serve in another nx process".
NX_SERVE_STATE_DIR=/tmp/nx-serve
rm -rf "$NX_SERVE_STATE_DIR"

export NX_WORKSPACE_DATA_DIRECTORY="$NX_SERVE_STATE_DIR/workspace-data"
export NX_CACHE_DIRECTORY="$NX_SERVE_STATE_DIR/cache"

exec npx nx run demo-api:serve
