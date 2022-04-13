# @dereekb/components
NOTE: This README and accompanying documentation is still a work in progress and is incomplete.

### Status
main:

[![CircleCI](https://circleci.com/gh/dereekb/dbx-components/tree/main.svg?style=shield)](https://circleci.com/gh/dereekb/dbx-components/tree/main)

develop: 

[![CircleCI](https://circleci.com/gh/dereekb/dbx-components/tree/develop.svg?style=shield)](https://circleci.com/gh/dereekb/dbx-components/tree/develop)

## Setup
Run `npm install` to install all dependencies. It is also important that you install the following tools:

- [nodejs](https://nodejs.org/en/)
- [Docker](https://www.docker.com/)

This project's workspace is designed to run in a Unix-like environment. Development in a Windows environment is not tested/supported.

## Build

Run `nx build demo` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `nx affected:test` to execute the unit tests affected by a change.

## Running unit tests with firebase
Unit tests that require firebase are run through the Docker container. This lets our tests access the emulator. Since all tests are run within the container, and the container is not configured to use service ports, it can be run at the same time as the demo.

Run `nx watch firebase` to execute the unit tests and watch for changes.

Run `nx test firebase` to execute the unit tests.

# Demo
This library has a working demo frontend and backend attached to it.

## Development server

There are two development servers: the Angular context, and the Firebase emulator context.

### Angular
The angular development server can run directly on your machine. Run `./server-web.sh` to start the angular development server and start the demo in your browser.

It will talk with the firebase development server by default.

### Firebase Emulator
The firebase emulator is run within a docker container. This is to allow consistent configuration described in the Dockerfile.

Run `./server-web.sh` to start the firebase development server.

Notes: 
- `demo-api`'s `watch-emulators` nx target uses [entr](http://eradman.com/entrproject/) to watch for changes in the demo-api's dist directory and restart the emulators automatically. The firebase emulator suite does not support hot-reload by default.

## Running end-to-end tests

TODO

# Contributing

TODO: move to contributing guide

## commits
This library uses https://github.com/jscutlery/semver to maintain versions. All versions are synchronized/shared between all sub-libraries.

Commits made should follow the following conventions: 

https://www.conventionalcommits.org/en/v1.0.0/
