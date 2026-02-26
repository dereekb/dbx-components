import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'nestjs',
  pathFromRoot: __dirname,
  projectName: 'zoho-nestjs',
  test: {
    testTimeout: 12000
  }
});
