import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: __dirname,
  projectName: 'dbx-core',
  projectSpecificSetupFiles: ['src/test-setup.ts'],
  test: {
    maxWorkers: 1
  }
});
