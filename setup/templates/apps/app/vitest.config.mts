import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: __dirname,
  projectName: 'APP_NAME',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
