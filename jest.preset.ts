// @ts-nocheck
const nxPreset = require('@nx/jest/preset');
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
let globalSetup = nxPreset.globalSetup;
let transform;

switch (appTestType) {
  case 'angular':
    // angular needs jsdom and serializers
    // globalSetup = 'jest-preset-angular/global-setup';
    snapshotSerializers = jestPresetAngularSerializers;
    testEnvironment = `${rootPath}/jest.environment.jsdom.ts`; // 'jsdom';
    transform = {
      '^.+\\.(ts|js|mjs|html|svg)$': ['jest-preset-angular', { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$' }]
    };
    break;
  case 'firebase':
  case 'nestjs':
  case 'node':
    transform = {
      '^.+\\.(ts|js|mjs|html|svg)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$' }]
    };
    break;
}

module.exports = {
  /**
   * Presets here: https://github.com/nrwl/nx/blob/master/packages/jest/preset/jest-preset.ts
   *
   * This project prefers to keep all the configuration between projects here, switching between them using the "appTestType" global variable for configuring things.
   */
  ...nxPreset,

  maxWorkers: 3,
  setupFilesAfterEnv: [...(nxPreset.setupFilesAfterEnv ?? []), ...appTestTypeSetupFiles, ...(customTestSetup ? customTestSetup : []), 'jest-date'],

  testEnvironment,

  testEnvironmentOptions: {},

  globalSetup,

  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: `${rootPath}/` }), // use to resolve packages in the project
  resolver: `${rootPath}/jest.resolver.js`, // '@nx/jest/plugins/resolver',

  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],

  transform,

  snapshotSerializers,

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
