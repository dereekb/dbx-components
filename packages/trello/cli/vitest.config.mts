import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: import.meta.dirname,
  projectName: 'trello-cli',
  test: {
    testTimeout: 10000,
    /**
     * Pinned ON — the specs point the CLI at their own temporary config directory and stub process.exit / the output
     * writer; a shared module registry would leak one file's state into the next.
     */
    isolate: true
  }
});
