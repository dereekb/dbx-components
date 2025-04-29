/**
 * Merges dependencies from nested dependencies tbat Nx seems to not be currently picking up properly.
 *
 * We have to build a package.json for hellosubs-api so it deploys properly on firebase.
 */
const fs = require('fs');
const throwErrorIfFileMissing = false;

const rootPackageJson = JSON.parse(fs.readFileSync('./package.json').toString());
const { version, engines, dependencies: rootDependencies } = rootPackageJson;

const packageJsonFilesToMerge = ['./node_modules/@dereekb/nestjs/mailgun/package.json'];
const packageJsonObjects = packageJsonFilesToMerge.map((x) => {
  let result = {};

  if (!fs.existsSync(x)) {
    if (throwErrorIfFileMissing) {
      throw new Error(`The file ${x} was not found.`);
    }
  } else {
    result = JSON.parse(fs.readFileSync(x).toString());
  }

  return result;
});

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

// pull any other specific dependencies that are listed here into the package.json.
const dependenciesToPullFromRootByName = ['mailgun.js'];

dependenciesToPullFromRootByName.forEach((depName) => {
  if (!rootDependencies[depName]) {
    throw new Error(`The dependency ${depName} was not found in package.json.`);
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
console.log(JSON.stringify(result, undefined, 2)); // output to console/stdout to allow piping.
