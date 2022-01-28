# dbx-firebase

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Unit tests are run through the Docker container. This lets our tests access the emulator. Since all tests are run within the container, and the container is not configured to use service ports, it can be run at the same time as the demo.

Run `nx watch dbx-firebase` to execute the unit tests and watch for changes.

Run `nx test dbx-firebase` to execute the unit tests.
