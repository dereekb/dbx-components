import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: import.meta.dirname,
  projectName: 'zoho-node',
  test: {
    testTimeout: 10000
  }
});
