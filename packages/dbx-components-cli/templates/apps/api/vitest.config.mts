import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: import.meta.dirname,
  projectName: 'API_APP_NAME',
  requiresFirebaseEnvironment: true,
  test: {
    maxWorkers: 3
  }
});
