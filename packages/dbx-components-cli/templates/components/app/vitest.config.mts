import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: import.meta.dirname,
  projectName: 'ANGULAR_COMPONENTS_NAME',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
