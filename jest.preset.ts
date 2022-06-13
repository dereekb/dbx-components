const nxPreset = require('@nrwl/jest/preset');
const isCI = require('is-ci');
const { pathsToModuleNameMapper } = require('ts-jest');
const { paths } = require('./tsconfig.base.json').compilerOptions;
const jestPresetAngularSerializers = require('jest-preset-angular/build/serializers');

// Since some folders are nested (util-test, firebase-test, etc.) we declare the global testFolderRootPath in their jest.preset.ts and it gets read here.
const appTestType = global.appTestType ?? 'node';
let customTestSetup = [].concat(global.customTestSetup ?? []);

const rootPath = global.testFolderRootPath ?? '<rootDir>/../..'; // most packages are 2 folders deep.

let testSetup = `${rootPath}/jest.setup.${appTestType}.ts`;

let testEnvironment = 'node';
let appTestTypeSetupFiles = [testSetup];
let snapshotSerializers = [];

switch (appTestType) {
  case 'angular':
    // angular needs jsdom and serializers
    snapshotSerializers = jestPresetAngularSerializers;
    testEnvironment = 'jsdom';
    break;
  case 'firebase':
  case 'nestjs':
  case 'node':
    break;
}

module.exports = {
  ...nxPreset,
  maxConcurrency: 3,
  maxWorkers: 3,
  setupFilesAfterEnv: [...(nxPreset.setupFilesAfterEnv ?? []), ...appTestTypeSetupFiles, ...(customTestSetup ? customTestSetup : []), 'jest-date'],

  testEnvironment,
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
      stringifyContentPathRegex: '\\.(html|svg)$'
    }
  },
  // globalSetup: 'jest-preset-angular/global-setup',

  moduleFileExtensions: ['ts', 'html', 'js', 'mjs', 'json'],
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: `${rootPath}/` }), // use to resolve packages in the project
  resolver: `${rootPath}/jest.resolver.js`,

  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': 'jest-preset-angular'
  },

  snapshotSerializers: snapshotSerializers,

  reporters: isCI
    ? [
        'default',
        [
          'jest-junit',
          {
            outputDirectory: `${rootPath}/.reports/jest`
          }
        ]
      ]
    : ['default']
};
