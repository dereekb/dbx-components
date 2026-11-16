import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: import.meta.dirname,
  projectName: 'microsoft-cli',
  test: {
    testTimeout: 10000,
    /**
     * Pinned ON — the specs point the CLI at their own temporary config directory and token file; a
     * shared module registry would leak one file's config into the next.
     */
    isolate: true
  }
});
