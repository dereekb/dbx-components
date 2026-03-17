import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'nestjs',
  pathFromRoot: __dirname,
  projectName: 'calcom-nestjs',
  test: {
    testTimeout: 12000
  }
});
