import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: __dirname,
  projectName: 'API_APP_NAME',
  requiresFirebaseEnvironment: true,
  test: {
    maxWorkers: 3
  }
});
