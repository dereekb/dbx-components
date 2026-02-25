import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: __dirname,
  projectName: 'dbx-web-mapbox',
  projectSpecificSetupFiles: ['src/test-setup.ts']
});
