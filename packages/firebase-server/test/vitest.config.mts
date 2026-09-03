import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: import.meta.dirname,
  projectName: 'firebase-server-test',
  requiresFirebaseEnvironment: true,
  test: {
    maxWorkers: 3
  }
});
