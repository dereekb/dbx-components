import { createVitestConfig } from '../../../vitest.preset.config.mjs';
import { resolve } from 'node:path';

// `@dereekb/dbx-cli` is narrowed to the pure, dependency-free route-model-tag grammar module so the
// rule's tests don't load the full dbx-cli barrel (ts-morph / yargs / nestjs). Mirrors the bundle
// alias in `rollup.alias-internal.config.ts`; both expose the same `parseRouteModelTag` grammar.
const baseConfigFn = createVitestConfig({
  type: 'node',
  pathFromRoot: __dirname,
  projectName: 'dbx-cli-eslint'
});

const GRAMMAR_ALIAS = { '@dereekb/dbx-cli': resolve(__dirname, '../src/lib/route/route-model-tag.ts') };

export default (configEnv: Parameters<typeof baseConfigFn>[0]) => {
  const base = baseConfigFn(configEnv);
  return {
    ...base,
    resolve: {
      ...base.resolve,
      alias: {
        ...base.resolve?.alias,
        ...GRAMMAR_ALIAS
      }
    }
  };
};
