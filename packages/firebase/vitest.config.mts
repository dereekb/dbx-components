import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'firebase',
  pathFromRoot: __dirname,
  projectName: 'firebase',
  // Tests will encounter storage rule issues: https://github.com/firebase/firebase-tools-ui/issues/996#issuecomment-3954367815
  test: {
    maxWorkers: 1
  }
});
