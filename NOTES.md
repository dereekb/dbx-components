# Notes
Set of notes relevant to setting up an Nx environment, similar to this one.

# Using Nx
## Creating a NodeJs Library
Be sure to include the `--buildable` and `--publishable` flags if relevant.

Example: `nx g @nrwl/node:library firebase --buildable --publishable --importPath @dereekb/firebase`

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

### Settings Up NestJS For Firebase Functions (Standalone App)
You can alternatively use NestJS as a standalone app, and response to requests like this:

```
const bootstrap = async (expressInstance: Express) => {
  const app = await NestFactory.create(AppModule, expressInstance);
  await app.init();

  return app;
};

const main = bootstrap(server);

export const subscriptions = functions
  .pubsub
  .topic('cron-topic')
  .onPublish((context, message) => main.then(app => {
    return app.get(SubscribeService).initDailyCharges(context, message));
  });
```

https://docs.nestjs.com/standalone-applications

https://stackoverflow.com/questions/53307541/firebase-handle-cloud-events-within-nestjs-framework


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

The emulator do not require having `service_account.json` available, but would use it if you choose not to enable certain emulators. Make sure you get a valid service account JSON key file and add it to the workspace if you want to do this.

To run the emulators execute:

> `./serve-server.sh`

This file instructs docker to start a new container, and execute `nx serve demo-api` inside of it.

Docker will take time to build the Docker Container from our Dockerfile the first time. This may take a few minutes.

The first time the container runs, the firebase emulator function will download and cache files (mapped to .firebase via the `docker-compose.yml` file).

Behind the scenes, `nx serve demo-api` runs two commands in parallel:
- Watching the demo-api folder for buildings.
- Running emulators. The functions emulator watches and pulls from the `dist/apps/demo-api` folder.

Any changes made to the `demo-api` package will trigger. VS Code to build the project and update our dist, causing the functions emulator to update. This lets us develop in real time with an active emulated database.

You can read more about how this code base has enabled hot reloading in the Hot Reloading section below.

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
Firebase's emulators only support hot reloading of Firebase rules. 

To achieve hot reloading we use a combination of demo-api's `build-base` target along with the `entr` command, which watches for changes produced by `nx build-base demo-api`. 

Currently the emulators do not [shut down gracefully](https://github.com/firebase/firebase-tools/issues/3034) and/or communicate they have closed. We use the `./wait-for-ports.sh` script to shut these processes down within the docker container before attempting to restart the emulators. The script waits for about 5 seconds before hard-stopping the processes and waiting for the ports to be released.

### Deploying Firebase Functions

#### .env
The CI is responsible for deployments. It will generate a .env file directly into demo-api, but also copy .env.prod over from the root. This .env.prod contains all of our public environment variables, while the generated one contains the private variables.

These are deployed to cloud functions. Note that anyone with access to your Google Cloud Console can read the runtime variables.

#### CORS Issue
If you run into what looks like CORS issues, [check this issue comment out](https://github.com/firebase/firebase-js-sdk/issues/6182#issuecomment-1133525775). Most likely your cloud functions were deployed and are set to "authenticated only", which is incorrect.

### Firebase App Check
The dbx-components library has AppCheck enabled, so you will only be able to run the app against the emulators.

You can read more about AppCheck configuration [here](https://firebase.google.com/docs/app-check/web/recaptcha-provider).


# Adding Sub Libraries
Because this workspace has some customization over Nx, there's a few changes that need to be made after creating a new nested/sub library.

Steps/Checklist:

## Creating the Project
This example will follow the creation of dbx-form/mapbox.

Example: `nx generate @nrwl/angular:library --name=dbx-form-mapbox --buildable --publishable --importPath @dereekb/dbx-form/mapbox --directory=dbx-form/mapbox`

This will build a new library in the directory `packages/dbx-form/mapbox/dbx-form-mapbox`, but we will want to move it to `packages/dbx-form/mapbox` instead.

`workspace.json` will need to be update to point to the proper path:

```
"dbx-form-mapbox": "packages/dbx-form/mapbox",
```

## Parent Project Changes
The "parent project" (`dbx-form` in this case) needs to be updated to ignore building this project's files.

### tsconfig
Update `tsconfig.lib.json`, `tsconfig.json`, and `tsconfig.spec.json` to ignore the new directory. Add the following to each:

```
"exclude": ["mapbox/**"]
```

Extend any existing exclude where necessary.

### project.json
We want to update the `build` step to also call building the child project. The child project should not have a `build` step of its own, since its distribution requires the parent, so the parent project `dbx-form` will be configured to handle any build steps. For angular child projects, ng-packagr will automatically perform the build step when the parent (`dbx-form`) is built, so it is not required.

Add the following (except angular child projects):
```
{
  "description": "build dbx-form-mapbox production",
  "command": "npx nx run dbx-form-mapbox:build-base:production"
}
```


If there are other steps that `dbx-form-mapbox` requires, add them after this step.

### package.json
Update `package.json`'s exports value to include the new dist output from the child project. If it is an angular project, you'll exclude main,types and default since ng-packagr will apply these automatically.

```
"./mapbox": {
  "main": "./mapbox/index.js",
  "types": "./mapbox/index.d.ts",
  "default": "./mapbox/index.js"
}
```

For angular projects:

```
"./mapbox": {}
```

## New/Child Project Changes
We now need to configure the project to build and be used properly. Remember, the generated path was one level too deep, so we will need to update all the paths to reflect the new changes.

### Path Replacement
Search `packages/dbx-form/mapbox/dbx-form-mapbox` and replace it with `packages/dbx-form/mapbox`. 

There will also be several relative paths that are `../../../../` that need to be replaced to `../../../` within the newly created project. Some files include `ng-package.json`, `project.json`, `tsconfig.spec.json`, `tsconfig.lib.json` and `tsconfig.json`.

### jest.config.ts
Since the dbx-components library has a lot of configuration setup in `jest.preset.ts`, we can simplify the setup here. Note, this is ONLY for this library. Your own project and other projects may be configured differently.

```
/* eslint-disable */
(global as any).appTestType = 'angular';
(global as any).testFolderRootPath = '<rootDir>/../../..';

module.exports = {
  displayName: 'dbx-form-mapbox',
  preset: '../../../jest.preset.ts',
  coverageDirectory: '../../../../coverage/packages/dbx-form/mapbox',
};
```

### README.md
Either delete it or replace it with the standard README.md that is in all the other packages. Since this package isn't directly uploaded to npmjs.org it doesn't matter what the contents are.

### project.json
Change `build` to `build-base` in the child `dbx-form-mapbox` project.json. 

Add the following line to `build-base`:

```
      "dependsOn": []
```

This will prevent the `build-base` step from potentially calling a build-loop. Since `dbx-form-mapbox` is always built after the parent projects, this is ok. In some cases where this has dependencies that may not be build yet, we can add them as dependencies of `dbx-form` so they're built in the proper order.

### .eslintrc.json
This project has shared angular eslintrc configuration in the root. Update to the following:

```
{
  "extends": ["../../.eslintrc.angular.json"],
  "ignorePatterns": ["!**/*"]
}
```
