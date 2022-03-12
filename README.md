# @dereekb/components

### Status
main:

[![CircleCI](https://circleci.com/gh/dereekb/dbx-components/tree/main.svg?style=shield)](https://circleci.com/gh/dereekb/dbx-components/tree/main)

develop: 

[![CircleCI](https://circleci.com/gh/dereekb/dbx-components/tree/develop.svg?style=shield)](https://circleci.com/gh/dereekb/dbx-components/tree/develop)


This project was generated using [Nx](https://nx.dev).

<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="450"></p>

🔎 **Smart, Fast and Extensible Build System**

TODO

## Build

Run `nx build demo` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `nx affected:test` to execute the unit tests affected by a change.

## Running unit tests with firebase

Unit tests that require firebase are run through the Docker container. This lets our tests access the emulator. Since all tests are run within the container, and the container is not configured to use service ports, it can be run at the same time as the demo.

Run `nx watch firebase` to execute the unit tests and watch for changes.

Run `nx test firebase` to execute the unit tests.

## Further help

Visit the [Nx Documentation](https://nx.dev) to learn more.

# Demo
This library has a working demo frontend and backend attached to it.

## Development server

TODO

## Running end-to-end tests

TODO

# Contributing

TODO: move to contributing guide

## commits
This library uses https://github.com/jscutlery/semver to maintain versions. All versions are synchronized/shared between all sub-libraries.

Commits made should follow the following conventions:

https://www.conventionalcommits.org/en/v1.0.0/
