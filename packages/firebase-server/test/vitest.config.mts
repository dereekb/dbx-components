import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: __dirname,
  projectName: 'firebase-server-test'
});
