import { createVitestConfig } from '../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'node',
  pathFromRoot: __dirname,
  projectName: 'dbx-cli',
  test: {
    /**
     * Pinned ON — the preset otherwise turns isolation OFF in CI, which shares one module registry
     * across every spec file in a worker and silently breaks the file-level `vi.mock()` calls these
     * specs rely on (`auth.middleware.spec.ts`, `auth.command.factory.spec.ts`, `cli.context.spec.ts`).
     *
     * The failure is order-dependent and bidirectional: whichever spec loads a module first wins, so
     * `run.spec.ts` — which imports the whole `run.ts` graph (`cli.context`, `util/output`,
     * `auth.command.factory`, `token.cache`, `env.resolve`) — either inherits another file's mocks or
     * voids them. Both directions produce CI-only failures that never reproduce locally.
     */
    isolate: true
  }
});
