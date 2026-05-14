import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: __dirname,
  projectName: 'demo-cli',
  requiresFirebaseEnvironment: true,
  test: {
    testTimeout: 30000
  }
});
