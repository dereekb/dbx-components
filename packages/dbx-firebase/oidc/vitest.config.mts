import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: import.meta.dirname,
  projectName: 'dbx-firebase-oidc',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
