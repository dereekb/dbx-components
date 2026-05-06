import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: __dirname,
  projectName: 'demo-cli',
  test: {
    testTimeout: 10000
  }
});
