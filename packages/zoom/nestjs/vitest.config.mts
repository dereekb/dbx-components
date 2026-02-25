import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'nestjs',
  pathFromRoot: __dirname,
  projectName: 'zoom-nestjs',
  test: {
    testTimeout: 12000
  }
});
