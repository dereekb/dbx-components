import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: import.meta.dirname,
  projectName: 'trello-node',
  test: {
    testTimeout: 10000
  }
});
