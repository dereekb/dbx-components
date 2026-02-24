import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: __dirname,
  projectName: 'util-fetch',
  test: {
    testTimeout: 30000
  }
});
