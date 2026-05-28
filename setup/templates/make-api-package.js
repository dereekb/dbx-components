/**
 * Merges dependencies from nested dependencies that Nx seems to not be currently picking up properly when generating
 * the package.json for the output app api firebase dist. This causes npm ci to fail on Google Cloud.
 *
 * The cause of the error is not always straight forward. You'll have to play with the settings to understand what is missing.
 *
 * The final package.json that is built by the build-base target for your api app is a mix of the api app-specific package.json and
 * the root package.json, which includes overrides.
 *
 * We have to build a package.json for app-api so it deploys properly on firebase.
 */
const fs = require('fs');

const rootPackageJson = JSON.parse(fs.readFileSync('./package.json').toString());
const { version, engines, dependencies: rootDependencies, devDependencies: rootDevDependencies } = rootPackageJson;

const packagesToGetPackageJsonsToMerge = [
  //
  '@dereekb/util',
  '@dereekb/date',
  '@dereekb/model',
  '@dereekb/rxjs',
  '@dereekb/nestjs',
  '@dereekb/firebase',
  '@dereekb/firebase-server'
];

const explicitPackageJsonFilesToMerge = [];

const packageJsonFilesToMerge = [
  // from packages
  ...packagesToGetPackageJsonsToMerge.map((x) => `./node_modules/${x}/package.json`),
  // other package.json file paths
  ...explicitPackageJsonFilesToMerge
];

const packageJsonObjects = packageJsonFilesToMerge.map((x) => JSON.parse(fs.readFileSync(x).toString()));

const dependencies = {};

packageJsonObjects.forEach((x) => {
  const { peerDependencies } = x;

  if (peerDependencies) {
    Object.keys(peerDependencies).forEach((depName) => {
      const version = peerDependencies[depName];
      dependencies[depName] = version;
    });
  }
});

// pull any other specific dependencies that should be pulled in from the root package.json.
// These dependencies MUST be declared in the root package.json, otherwise it will fail.
const dependenciesToPullFromRootByName = [
  //
  // '@google-cloud/firestore',
  // '@google-cloud/storage'
];

dependenciesToPullFromRootByName.forEach((depName) => {
  if (!rootDependencies[depName]) {
    let message = `The dependency ${depName} was not found in package.json.`;

    if (rootDevDependencies[depName]) {
      message += ` It was however found in devDependencies, which might be a mistake. Please resolve issue.`;
    }

    throw new Error(message);
  }

  dependencies[depName] = rootDependencies[depName];
});

const result = {
  version,
  dependencies,
  engines
};

// ======================================
// Finish Configuration
// ======================================
// Write atomically: build the full content in memory above (where all the throwable
// logic lives), then write to a temp file and rename into place. We must NOT use a shell
// redirect (`> package.json`) because the shell truncates the target to 0 bytes BEFORE this
// script runs - and if the script throws, the empty file breaks Nx's project graph for the
// whole workspace (the nx/core/package-json plugin can't parse an empty file).
const outputPath = './API_APP_FOLDER/package.json';
const tmpPath = `${outputPath}.tmp`;
const contents = `${JSON.stringify(result, undefined, 2)}\n`;

fs.writeFileSync(tmpPath, contents);
fs.renameSync(tmpPath, outputPath);

console.log(contents); // also echo the generated package.json to stdout.
console.error(`Wrote ${outputPath}`); // status line to stderr.
