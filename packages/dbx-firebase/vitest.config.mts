import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: __dirname,
  projectName: 'dbx-firebase',
  projectSpecificSetupFiles: ['src/test-setup.ts'],
  requiresFirebaseEnvironment: true
});
