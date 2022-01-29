const nxPreset = require('@nrwl/jest/preset');
const isCI = require('is-ci');

module.exports = {
  ...nxPreset,
  setupFilesAfterEnv: [...nxPreset.setupFilesAfterEnv ?? [], 'jest-date', '<rootDir>/../../jest.setup.ts'],
  reporters: (isCI) ? ['default', ['jest-junit', {
    outputDirectory: '<rootDir>/../../.reports/jest',
  }]] : ['default']
};
