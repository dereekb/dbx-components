# Notes
Set of notes relevant to setting up an Nx environment, similar to this one.

# Using Nx
## Creating a NodeJs Library
Be sure to include the `--buildable` and `--publishable` flags if relevant.

Example: `nx g @nrwl/node:library firebase --buildable --publishable --importPath @dereekb/firebase`

### Creating a nested library
For nested libraries, you can do the following:

`nx g @nrwl/node:library nestjs/stripe --buildable --publishable --importPath @dereekb/nestjs/stripe`
`nx g @nrwl/node:library nestjs/twilio --buildable --publishable --importPath @dereekb/nestjs/twilio`

## Creating an Angular Library

Example: `nx generate @nrwl/angular:library --name=dbx-firebase --buildable --publishable --importPath @dereekb/dbx-firebase`

# Setting up Firebase for Nx
These steps were use for setting up firebase for the demo components. Inspiration [from here](https://itnext.io/nx-nest-firebase-the-dream-616e8ee71920).

Setting up our workspace to work with Firebase is fairly straightforward. Start by making sure Firebase is [installed globally](https://firebase.google.com/docs/functions/get-started):

> `npm install -g firebase-tools@latest`

Go ahead and set up your project on Firebase if you have not.

https://console.firebase.google.com/

Create a Service Account to use for development in the Firebase console. Download the key as JSON and add to the root directory as `service_account.json`.

## Setup
Start by initializing firebase in the root directory:

> `firebase init`

Skip installing node_modules.

Go ahead and delete the created `public` and `functions` directories. We will update the firebase configuration to deploy from the `dist` folders, as configure the build steps.

## Webapp
Create an angular project using ng generate.

Example: `nx generate @nrwl/angular:app --name=demo`

The angular project is now setup properly. When built, its output will go to the `dist/apps/demo` folder.

### Configuring Firebase.json
We just need to update the folder firebase pulls from to instead pull from the webapp's dist folder. Update `firebase.json` by changing the `hosting` section's `public` value to be `dist/apps/demo`.

It should look like this:

```
"hosting": {
    "public": "dist/apps/demo",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
```

### Configuring project.json
We can add functions to our `project.json` for `demo` to call build and the firebase functions for deploying to hosting.

Find `targets` in your `project.json`, and add the following targets:

```
"deploy-dist-to-hosting": {
  "builder": "@nrwl/workspace:run-commands",
  "options": {
    "command": "firebase deploy --only hosting"
  }
}
```

This will deploy whatever content is configured for `public` in `firebase.json`, which we configured above to be `dist/apps/demo`.

Add the section below to add an action that calls build before calling deploy.

```
"deploy": {
  "builder": "@nrwl/workspace:run-commands",
  "options": {
    "commands": [
      {
        "command": "npx nx build demo"
      },
      {
        "command": "npx nx deploy-dist-to-hosting demo"
      }
    ],
    "parallel": false
  }
}
```

Now we can deploy our hosting with this command:

> `nx deploy demo`

## NestJs
We will be creating a NestJS project that will be deployed to Google's functions cloud.

Create a NestJS project using the following:

Example: `nx generate @nrwl/nest:application demo-api`

### Setting Up NestJS for Firebase Functions Using onRequest()
Copy the contents of `apps/demo-api/src/main.ts`. This will instruct your app to direct all https requests to 

More details here:
https://firebase.google.com/docs/functions/http-events

Alternatively, if you do not want to use onRequest but want to use NestJS, you can use NestJS as a Standalone App (see next section).

### Configuring Firebase.json
We just need to update the folder firebase pulls from to instead pull from the webapp's dist folder. Update `firebase.json` by changing the `functions` section's `source` value to be `dist/apps/demo-api`. Also add `runtime` and set it to `nodejs16`.

It should look like this:

```
"functions": {
    "source": "dist/apps/demo-api",
    "runtime": "nodejs16",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  },
```

### Emulators In Docker
We use Docker to run the emulators within a Docker Container. This lets us not worry about the host system having Java and other dependencies installed.

The emulators do not require having `service_account.json` available, but if one is available it will be used in the background.

To run the emulators execute:

> `./serve-server.sh`

This file instructs docker to start a new container, and execute `nx serve demo-api` inside of it.

Docker will take time to build the Docker Container from our Dockerfile the first time. This may take a few minutes.

The first time the container runs, the firebase emulator function will download and cache files (mapped to .firebase via the `docker-compose.yml` file).

Behind the scenes, `nx serve demo-api` runs two commands in parallel:
- Watching the demo-api folder for buildings.
- Running emulators. The functions emulator watches and pulls from the `dist/apps/demo-api` folder.

Any changes made to the `demo-api` package will trigger. VS Code to build the project and update our dist, causing the functions emulator to update. This lets us develop in real time with an active emulated database.

### Testing
Some tests run in just the node context, while others are run with the firebase emulators.


### CI Testing Output
A couple things are configured for the CI to enable reports to be output to `.reports/jest`:

- All our project configurations for `nx test` and `nx run-tests` have an added `outputs` values that communicates to nx that they have output that belongs in the nx cloud cache. This is important, because it lets nx avoid having to re-run tests. The problem would be that without this output, the test's CLI output is cached and played back, but the jest-junit output would not be reported. This configuration resolves that issue.
- `jest-junit` is configured partially in `jest.preset.js` to output to the `.reports/jest` folder. It also only adds the jest-junit reporter in CI environments.
- All projects have a `.env` file that adds environment variables to tell jest-junit what to export the file as.

These three items come together and enable jest-junit to do it's job, and circleci to capture our testing output.

# Other General Notes
## Firebase
### Body Parsing
By default, Firebase API calls have their body parsed by express. This occurs before it reaches our demo-api's onRequest express server. If you add in additional body parsers and handlers be sure to update the request appropriately.

### Firebase Emulator Hot Reloading
Firebase's emulators only support hot reloading of rules. To achieve hot reloading we use a combination of demo-api's `build-base` target along with the `entr` command, which watches for changes produced by `nx build-base demo-api`. Currently the emulators do not [shut down gracefully](https://github.com/firebase/firebase-tools/issues/3034) and/or communicate they have closed. We use the `./wait-for-ports.sh` script to shut these processes down within the docker container before attempting to restart the emulators. The script waits for about 5 seconds before hard-stopping the processes and waiting for the ports to be released. 

### Deploying Firebase Functions
If you run into what looks like CORS issues, [check this issue comment out](https://github.com/firebase/firebase-js-sdk/issues/6182#issuecomment-1133525775). Most likely your cloud functions were deployed and are set to "authenticated only", which is incorrect.
