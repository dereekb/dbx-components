import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: import.meta.dirname,
  projectName: 'demo-api',
  requiresFirebaseEnvironment: true,
  test: {
    maxWorkers: 3
  }
});
