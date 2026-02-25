import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: __dirname,
  projectName: 'dbx-form-calendar',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
