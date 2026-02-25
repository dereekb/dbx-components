import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: __dirname,
  projectName: 'demo-components',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
