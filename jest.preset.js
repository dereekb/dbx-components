const nxPreset = require('@nrwl/jest/preset');

module.exports = {
  ...nxPreset,
  setupFilesAfterEnv: [...nxPreset.setupFilesAfterEnv ?? [], 'jest-date', '<rootDir>/../../jest.setup.ts']
};
