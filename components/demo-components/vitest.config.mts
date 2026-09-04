import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: import.meta.dirname,
  projectName: 'demo-components',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
