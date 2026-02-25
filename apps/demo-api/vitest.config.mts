import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: __dirname,
  projectName: 'demo-api',
  requiresFirebaseEnvironment: true
});
