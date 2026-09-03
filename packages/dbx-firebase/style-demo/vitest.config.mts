import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: import.meta.dirname,
  projectName: 'dbx-firebase-style-demo',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
