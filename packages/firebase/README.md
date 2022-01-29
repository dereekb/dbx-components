# firebase

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Unit tests are run through the Docker container. This lets our tests access the emulator. Since all tests are run within the container, and the container is not configured to use service ports, it can be run at the same time as the demo.

Run `nx watch firebase` to execute the unit tests and watch for changes.

Run `nx test firebase` to execute the unit tests.

### Firebase Related Unit Test Notes

https://firebase.google.com/docs/rules/unit-tests#rut-v2-common-methods
