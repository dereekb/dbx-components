import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: import.meta.dirname,
  projectName: 'demo-cli',
  requiresFirebaseEnvironment: true,
  test: {
    testTimeout: 30000
  }
});
