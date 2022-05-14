const nxPreset = require('@nrwl/jest/preset');
const isCI = require('is-ci');

// Since some folders are nested (util-test, firebase-test, etc.) we declare the global testFolderRootPath.
const rootPath = global.testFolderRootPath ?? '<rootDir>/../..';

module.exports = {
  ...nxPreset,
  setupFilesAfterEnv: [
    ...(nxPreset.setupFilesAfterEnv ?? []),
    'jest-date',
    `${rootPath}/jest.setup.ts`,
  ],
  reporters: isCI
    ? [
      'default',
      [
        'jest-junit',
        {
          outputDirectory: `${rootPath}/.reports/jest`,
        },
      ],
    ]
    : ['default'],
};
