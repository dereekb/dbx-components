import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: import.meta.dirname,
  projectName: 'zoho-cli',
  test: {
    testTimeout: 10000,
    /**
     * Pinned ON — the preset otherwise turns isolation OFF in CI, which shares one module registry
     * across every spec file in a worker. The config specs (`cli.config.merge.spec.ts`,
     * `auth.command.setup.spec.ts`, `auth.command.login.spec.ts`) each `vi.mock('node:os')` onto their
     * own temporary home; shared, the first file's mock wins and the others clean up a home the config
     * functions are not actually using, leaking one file's config into the next.
     */
    isolate: true
  }
});
