import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: import.meta.dirname,
  projectName: 'FIREBASE_COMPONENTS_NAME'
});
