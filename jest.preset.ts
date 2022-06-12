// https://github.com/rfprod/nx-ng-starter/blob/main/jest.preset.js
// use as a template

const nxPreset = require('@nrwl/jest/preset');
const isCI = require('is-ci');

const { pathsToModuleNameMapper } = require('ts-jest');
const { paths } = require('./tsconfig.base.json').compilerOptions;

// Since some folders are nested (util-test, firebase-test, etc.) we declare the global testFolderRootPath.
const appTestType = global.appTestType ?? 'node';
const rootPath = global.testFolderRootPath ?? '<rootDir>/../..';

let testEnvironment = 'node';
let appTestTypeSetupFiles = [];

switch (appTestType) {
  case 'angular':
    appTestTypeSetupFiles.push(`${rootPath}/jest.setup.reflect.ts`);
    appTestTypeSetupFiles.push(`${rootPath}/jest.setup.angular.ts`);
    break;
  case 'nestjs':
  case 'node':
    appTestTypeSetupFiles.push(`${rootPath}/jest.setup.reflect.ts`);
    break;
}

module.exports = {
  ...nxPreset,
  maxConcurrency: 3,
  maxWorkers: 3,
  setupFilesAfterEnv: [...(nxPreset.setupFilesAfterEnv ?? []), ...appTestTypeSetupFiles, `<rootDir>/src/test-setup.ts`, 'jest-date'],

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
  resolver: 'jest-preset-angular/build/resolvers/ng-jest-resolver.js',

  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  transform: {
    '^.+\\.(ts|js|mjs|html|svg)$': 'jest-preset-angular'
  },
  /*
  transformIgnorePatterns: [
    'node_modules/(?!.*\\.mjs$)'
  ],
  */

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
